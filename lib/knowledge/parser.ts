// lib/knowledge/parser.ts - Document parsing for RAG
import { PDFParse } from 'pdf-parse';
import * as cheerio from 'cheerio';

export interface ParsedDocument {
  content: string;
  metadata: {
    pageCount?: number;
    charCount: number;
    title?: string;
    hasFAQStructure?: boolean;
  };
}

export type SupportedMimeType =
  | 'application/pdf'
  | 'text/plain'
  | 'text/markdown';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function detectMimeType(fileName: string): SupportedMimeType | null {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeMap: Record<string, SupportedMimeType> = {
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'md': 'text/markdown',
  };
  return mimeMap[ext || ''] || null;
}

export function validateFile(file: { size: number; name: string }): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }
  if (!detectMimeType(file.name)) {
    return { valid: false, error: 'Unsupported file type. Use PDF, TXT, or MD.' };
  }
  return { valid: true };
}

export function isSupported(mimeType: string): mimeType is SupportedMimeType {
  return ['application/pdf', 'text/plain', 'text/markdown'].includes(mimeType);
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: SupportedMimeType
): Promise<ParsedDocument> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePDF(buffer);
    case 'text/plain':
    case 'text/markdown':
      return parseText(buffer);
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  // pdf-parse v2 uses class-based API
  const parser = new PDFParse({ data: buffer });

  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    return {
      content: textResult.text,
      metadata: {
        pageCount: infoResult.total,
        charCount: textResult.text.length,
        title: infoResult.info?.Title as string | undefined,
      },
    };
  } finally {
    await parser.destroy();
  }
}

function parseText(buffer: Buffer): ParsedDocument {
  const content = buffer.toString('utf-8');
  return {
    content,
    metadata: {
      charCount: content.length,
    },
  };
}

/**
 * Parse a URL into a structured document.
 *
 * Uses the tiered scraper (Firecrawl → Jina → fetch) to handle both
 * static HTML pages and JS-rendered SPAs (React listing pages, etc.).
 *
 * - Tier 1/2 return Markdown directly → we use it as-is (links preserved).
 * - Tier 3 returns raw HTML → we run the Cheerio pipeline to extract content.
 */
export async function parseURL(url: string): Promise<ParsedDocument> {
  const { fetchPage } = await import('./scraper');

  const result = await fetchPage(url, {
    // Hint for JS-rendering providers: wait for listing items to appear.
    // This covers the "ghost data" case where React hydrates after load.
    waitForSelector: '.listing-item, .property-card, [data-listing], article',
  });

  // ================================================================
  // PATH A: Markdown returned by Firecrawl or Jina (JS-rendered)
  // ================================================================
  if (result.markdown) {
    let content = result.markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    // Detect FAQ patterns in the markdown (Q:/A: markers)
    const faqMatches = content.match(/^Q:\s.+/gim);
    const hasFAQStructure = (faqMatches?.length ?? 0) >= 2;

    return {
      content,
      metadata: {
        charCount: content.length,
        title: result.title || undefined,
        hasFAQStructure,
      },
    };
  }

  // ================================================================
  // PATH B: Raw HTML from static fetch → Cheerio pipeline
  // ================================================================
  const html = result.html!;
  const $ = cheerio.load(html);

  // Extract title before removing elements
  const title = $('title').text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content');

  // Extract structured data from JSON-LD before we remove script tags
  const faqParts: string[] = [];
  const entityParts: string[] = [];
  // Track entity names/descriptions for deduplication against generic HTML content
  const entityFingerprints = new Set<string>();

  const ENTITY_TYPES = new Set([
    'Product', 'RealEstateListing', 'Place', 'ApartmentComplex',
    'Residence', 'House', 'SingleFamilyResidence', 'Apartment',
    'LodgingBusiness', 'Hotel', 'LocalBusiness',
  ]);

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());

      // --- FAQ extraction (existing) ---
      const faqItems = json['@type'] === 'FAQPage'
        ? json.mainEntity
        : json['@graph']?.find((n: any) => n['@type'] === 'FAQPage')?.mainEntity;
      if (Array.isArray(faqItems)) {
        for (const item of faqItems) {
          const q = item.name || item.text;
          const a = item.acceptedAnswer?.text;
          if (q && a) faqParts.push(`Q: ${q}\nA: ${a}`);
        }
      }

      // --- Structured entity extraction ---
      // Collect entities from top-level object or @graph array
      const candidates: any[] = [];
      if (ENTITY_TYPES.has(json['@type'])) {
        candidates.push(json);
      }
      if (Array.isArray(json['@graph'])) {
        for (const node of json['@graph']) {
          if (ENTITY_TYPES.has(node['@type'])) {
            candidates.push(node);
          }
        }
      }
      // Also handle arrays of entities at the top level (some WP plugins emit these)
      if (Array.isArray(json)) {
        for (const node of json) {
          if (node && ENTITY_TYPES.has(node['@type'])) {
            candidates.push(node);
          }
        }
      }

      for (const entity of candidates) {
        const parts: string[] = [];
        const name = entity.name || entity.headline;
        if (name) {
          parts.push(`**${name}**`);
          entityFingerprints.add(normalizeForDedup(name));
        }

        const description = entity.description;
        if (description) {
          parts.push(description);
          entityFingerprints.add(normalizeForDedup(description));
        }

        // Address — structured or string
        const addr = entity.address;
        if (addr) {
          if (typeof addr === 'string') {
            parts.push(`Address: ${addr}`);
          } else if (addr.streetAddress || addr.addressLocality) {
            const formatted = [
              addr.streetAddress,
              addr.addressLocality,
              addr.addressRegion,
              addr.postalCode,
            ].filter(Boolean).join(', ');
            if (formatted) parts.push(`Address: ${formatted}`);
          }
        }

        // Price — offers or direct
        const price = entity.price
          || entity.offers?.price
          || entity.offers?.lowPrice;
        const priceCurrency = entity.priceCurrency
          || entity.offers?.priceCurrency
          || '';
        if (price) {
          parts.push(`Price: ${priceCurrency} ${price}`.trim());
        }

        if (parts.length > 0) {
          entityParts.push(parts.join('\n'));
        }
      }
    } catch { /* malformed JSON-LD — skip */ }
  });

  // Remove non-content elements
  $('script, style, nav, footer, header, aside, noscript, iframe, svg').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('.nav, .navbar, .footer, .sidebar, .menu, .advertisement, .ads').remove();

  // Determine content root for all extraction phases
  const contentRoot = $('main, article, [role="main"], .content, .main-content, #content, #main');
  const rootEl = contentRoot.length > 0 ? contentRoot : $('body');

  // Base URL for resolving relative hrefs to absolute
  const baseUrl = url;

  // ============================================
  // PHASE 1: Extract FAQ structures BEFORE generic content.
  // ============================================

  // 1a. <details>/<summary>
  rootEl.find('details').each((_, el) => {
    const $details = $(el);
    const question = $details.find('summary').first().text().trim();
    $details.find('summary').remove();
    const answer = inlineMarkdown($, $details, baseUrl).trim();
    if (question && answer) {
      faqParts.push(`Q: ${question}\nA: ${answer}`);
    }
  });
  rootEl.find('details').remove();

  // 1b. <dt>/<dd> definition lists
  rootEl.find('dl').each((_, dl) => {
    const $dl = $(dl);
    $dl.find('dt').each((__, dt) => {
      const $dt = $(dt);
      const question = $dt.text().trim();
      const answerParts: string[] = [];
      let $next = $dt.next();
      while ($next.length && $next.is('dd')) {
        answerParts.push(inlineMarkdown($, $next, baseUrl).trim());
        $next = $next.next();
      }
      if (question && answerParts.length) {
        faqParts.push(`Q: ${question}\nA: ${answerParts.join('\n')}`);
      }
    });
  });
  rootEl.find('dl').remove();

  // 1c. JSON-LD FAQPage schema already extracted above

  // ============================================
  // PHASE 1d: WordPress page-builder "Div Rescue"
  // Promote known WP text wrappers to <p>-equivalent so Phase 2 captures them.
  // ============================================
  const WP_TEXT_SELECTORS = [
    '.et_pb_text_inner',          // Divi Builder
    '.elementor-widget-text-editor', // Elementor
    '.elementor-text-editor',     // Elementor inner
    '.wpb_text_column .wpb_wrapper', // WPBakery
    '.fl-rich-text',              // Beaver Builder
    '.wp-block-group__inner-container', // Gutenberg group
    '.entry-content',             // Classic themes
    '.page-content',              // Generic WP
    '.sqs-block-content',         // Squarespace (bonus)
  ].join(', ');

  rootEl.find(WP_TEXT_SELECTORS).each((_, el) => {
    // Tag the element so Phase 2 picks it up alongside <p>
    $(el).addClass('__wp-text-rescued');
  });

  // ============================================
  // PHASE 2: Generic content with semantic Markdown preservation.
  // ============================================
  const contentParts: string[] = [];

  // Include rescued WP divs in the selector
  rootEl.find('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption, .__wp-text-rescued').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();

    const md = inlineMarkdown($, $el, baseUrl).trim();
    if (!md || md.length < 3) return;

    switch (tagName) {
      case 'h1':
        contentParts.push(`\n# ${md}\n`);
        break;
      case 'h2':
        contentParts.push(`\n## ${md}\n`);
        break;
      case 'h3':
        contentParts.push(`\n### ${md}\n`);
        break;
      case 'h4':
      case 'h5':
      case 'h6':
        contentParts.push(`\n#### ${md}\n`);
        break;
      case 'li':
        contentParts.push(`- ${md}`);
        break;
      case 'blockquote':
        contentParts.push(`> ${md}`);
        break;
      default:
        contentParts.push(md);
    }
  });

  // ============================================
  // PHASE 3: Combine — JSON-LD entities first (highest quality), then FAQ, then generic.
  // Deduplicate: if JSON-LD already captured a name/description, drop matching HTML lines.
  // ============================================
  const entitySection = entityParts.length > 0
    ? `## Listings\n\n${entityParts.join('\n\n---\n\n')}`
    : '';

  const faqSection = faqParts.length > 0 ? faqParts.join('\n\n') : '';

  // Deduplicate generic content against JSON-LD entity fingerprints.
  // A generic line is considered a duplicate if its normalized form is a
  // substring of (or identical to) any entity fingerprint.
  let dedupedParts: string[];
  if (entityFingerprints.size > 0) {
    dedupedParts = contentParts.filter(part => {
      const normalized = normalizeForDedup(part);
      // Skip very short fragments — they're too generic to match reliably
      if (normalized.length < 10) return true;
      for (const fp of entityFingerprints) {
        if (fp.includes(normalized) || normalized.includes(fp)) {
          return false; // duplicate — JSON-LD already has this
        }
      }
      return true;
    });
  } else {
    dedupedParts = contentParts;
  }

  const genericSection = dedupedParts.join('\n').trim();
  let content = [entitySection, faqSection, genericSection].filter(Boolean).join('\n\n');

  // If we got very little content, fall back to body text
  if (content.length < 100) {
    content = $('body').text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Clean up excessive whitespace while preserving structure
  content = content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return {
    content,
    metadata: {
      charCount: content.length,
      title: title || undefined,
      hasFAQStructure: faqParts.length > 0,
    },
  };
}

/**
 * Normalize a string for deduplication: lowercase, strip markdown/punctuation, collapse whitespace.
 * Used to detect when generic HTML content duplicates JSON-LD structured data.
 */
function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*{1,2}/g, '')        // strip bold/italic markers
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/[^\w\s]/g, ' ')       // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a possibly-relative URL against a base URL.
 * Returns the absolute URL string, or the original href if resolution fails.
 */
function resolveUrl(href: string, baseUrl?: string): string {
  if (!baseUrl) return href;
  // Already absolute
  if (/^https?:\/\//i.test(href)) return href;
  // Protocol-relative
  if (href.startsWith('//')) return `https:${href}`;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Convert a Cheerio element's inner content to lightweight Markdown.
 *
 * Preserves:
 *  - <a href="..."> → [text](absolute-url)
 *  - <strong>/<b>   → **text**
 *  - <em>/<i>       → *text*
 *  - <code>         → `text`
 *  - <br>           → newline
 *
 * Everything else collapses to plain text.
 * This keeps URLs visible to the LLM without the noise of full HTML.
 *
 * @param baseUrl — The page's URL, used to resolve relative hrefs to absolute.
 */
function inlineMarkdown(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<any>,
  baseUrl?: string
): string {
  let result = '';

  $el.contents().each((_, node) => {
    if (node.type === 'text') {
      result += $(node).text();
      return;
    }

    if (node.type !== 'tag') return;

    const tag = (node as any).tagName?.toLowerCase();
    const $node = $(node);

    switch (tag) {
      case 'a': {
        const rawHref = $node.attr('href') || '';
        const text = $node.text().trim();
        if (text && rawHref && !rawHref.startsWith('#') && !rawHref.startsWith('javascript')) {
          const href = resolveUrl(rawHref, baseUrl);
          result += `[${text}](${href})`;
        } else {
          result += text;
        }
        break;
      }
      case 'strong':
      case 'b': {
        const inner = inlineMarkdown($, $node, baseUrl);
        result += inner ? `**${inner}**` : '';
        break;
      }
      case 'em':
      case 'i': {
        const inner = inlineMarkdown($, $node, baseUrl);
        result += inner ? `*${inner}*` : '';
        break;
      }
      case 'code': {
        result += `\`${$node.text()}\``;
        break;
      }
      case 'br': {
        result += '\n';
        break;
      }
      default: {
        // Recurse into unknown tags (span, div wrappers, etc.)
        result += inlineMarkdown($, $node, baseUrl);
      }
    }
  });

  return result;
}
