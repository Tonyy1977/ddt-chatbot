// lib/knowledge/scraper.ts — Tiered page fetching with JS-rendering support
//
// Problem: standard fetch() + Cheerio cannot see content rendered by React/Vue/
// Angular. Listings, prices, and addresses that load via client-side JS appear
// as "ghost data" — the <h1> is captured but the actual list items are missing.
//
// Solution: a three-tier fetch strategy:
//   Tier 1: Firecrawl API  (FIRECRAWL_API_KEY) — JS-rendered, returns markdown
//   Tier 2: Jina Reader API (JINA_API_KEY)      — JS-rendered, returns markdown
//   Tier 3: Standard fetch + raw HTML            — no JS, Cheerio pipeline
//
// Tiers 1 and 2 are serverless-friendly (no Puppeteer binary needed on Vercel).
// Callers receive a FetchResult and branch on whether `markdown` is present.

// ============================================================================
// Types
// ============================================================================

export type FetchProvider = 'firecrawl' | 'jina' | 'fetch';

export interface FetchResult {
  /** Raw HTML string. Non-null only for the 'fetch' provider. */
  html: string | null;
  /** Pre-converted Markdown. Non-null for firecrawl/jina providers. */
  markdown: string | null;
  /** Page title extracted by the provider (if available). */
  title: string | null;
  /** Which tier actually served the response. */
  provider: FetchProvider;
}

export interface FetchOptions {
  /** Timeout in ms per request (default 30 000). */
  timeout?: number;
  /** If true, skip Tier 1/2 and go straight to fetch. Useful for sitemaps/XML. */
  forceStaticFetch?: boolean;
  /** CSS selector to wait for (hint for providers that support it). */
  waitForSelector?: string;
}

// ============================================================================
// Tier 1: Firecrawl (https://firecrawl.dev)
// ============================================================================

async function tryFirecrawl(
  url: string,
  opts: FetchOptions
): Promise<FetchResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';

  try {
    const body: Record<string, unknown> = {
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: opts.timeout || 30_000,
    };

    // Firecrawl v1 supports waitFor (CSS selector the page must contain)
    if (opts.waitForSelector) {
      body.waitFor = opts.waitForSelector;
    }

    const response = await fetch(`${baseUrl}/v1/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeout || 30_000),
    });

    if (!response.ok) {
      console.warn(`[scraper] Firecrawl returned ${response.status} for ${url}`);
      return null;
    }

    const json = await response.json() as {
      success: boolean;
      data?: {
        markdown?: string;
        metadata?: { title?: string };
      };
    };

    if (!json.success || !json.data?.markdown) {
      console.warn(`[scraper] Firecrawl returned no markdown for ${url}`);
      return null;
    }

    console.log(`[scraper] Firecrawl OK: ${url} (${json.data.markdown.length} chars)`);

    return {
      html: null,
      markdown: json.data.markdown,
      title: json.data.metadata?.title || null,
      provider: 'firecrawl',
    };
  } catch (error) {
    console.warn(
      `[scraper] Firecrawl failed for ${url}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ============================================================================
// Tier 2: Jina Reader (https://r.jina.ai)
// ============================================================================

async function tryJina(
  url: string,
  opts: FetchOptions
): Promise<FetchResult | null> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) return null;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      // Jina Reader options
      'X-Return-Format': 'markdown',
      'X-With-Links': 'true',
    };

    // Jina supports a wait-for-selector header
    if (opts.waitForSelector) {
      headers['X-Wait-For'] = opts.waitForSelector;
    }

    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(opts.timeout || 30_000),
    });

    if (!response.ok) {
      console.warn(`[scraper] Jina returned ${response.status} for ${url}`);
      return null;
    }

    const json = await response.json() as {
      code?: number;
      data?: {
        content?: string;
        title?: string;
      };
    };

    const markdown = json.data?.content;
    if (!markdown || markdown.length < 50) {
      console.warn(`[scraper] Jina returned insufficient content for ${url}`);
      return null;
    }

    console.log(`[scraper] Jina OK: ${url} (${markdown.length} chars)`);

    return {
      html: null,
      markdown,
      title: json.data?.title || null,
      provider: 'jina',
    };
  } catch (error) {
    console.warn(
      `[scraper] Jina failed for ${url}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// ============================================================================
// Tier 3: Standard fetch (no JS rendering)
// ============================================================================

async function tryStaticFetch(
  url: string,
  opts: FetchOptions
): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(opts.timeout || 30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  return {
    html,
    markdown: null,
    title: null, // Title extraction is done by the Cheerio pipeline in parser.ts
    provider: 'fetch',
  };
}

// ============================================================================
// Ghost Content Detection
// ============================================================================

// After a static fetch, check if the page likely has JS-rendered content we missed.
// This heuristic looks for common SPA/framework signatures in the raw HTML.
const JS_APP_SIGNATURES = [
  // React
  /<div\s+id=["'](?:root|__next|app)["'][^>]*>\s*<\/div>/i,
  // Vue
  /<div\s+id=["'](?:app|__nuxt)["'][^>]*>\s*<\/div>/i,
  // Angular
  /<app-root[^>]*>\s*<\/app-root>/i,
  // Generic empty main with a script bundle
  /<main[^>]*>\s*<\/main>\s*<script/i,
];

/**
 * Returns true if the HTML looks like an SPA shell with no server-rendered content.
 * This means a static fetch probably missed JS-rendered listings.
 */
export function looksLikeEmptySpaShell(html: string): boolean {
  return JS_APP_SIGNATURES.some(pattern => pattern.test(html));
}

/**
 * Detect specific "ghost data" scenarios: the page has structural markers
 * (headings like "Available Homes") but zero list items / data rows.
 * This is a strong signal that listings are JS-rendered.
 */
export function hasGhostListings(html: string): boolean {
  // Quick check: if there's a heading about listings but very few list items
  const hasListingHeading = /<h[1-3][^>]*>.*(?:listings?|properties|available|homes|rentals|catalog|products)/i.test(html);
  if (!hasListingHeading) return false;

  // Count actual data items (cards, rows, list items within content)
  const listItemCount = (html.match(/<(?:li|tr|article|div[^>]+class="[^"]*(?:card|item|listing|property)[^"]*")[^>]*>/gi) || []).length;

  // If we see a listing heading but fewer than 2 actual items, it's ghost data
  return listItemCount < 2;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Fetch a page using the best available method.
 *
 * Strategy:
 *  1. If a JS-rendering API is configured (Firecrawl or Jina), use it first.
 *     These handle React/Vue/Angular pages that load data via client-side JS.
 *  2. Fall back to standard fetch + raw HTML for Cheerio processing.
 *  3. If static fetch returns what looks like an empty SPA shell, warn the
 *     caller via the `provider` field so they can log the issue.
 *
 * @returns FetchResult with either `markdown` (tier 1/2) or `html` (tier 3).
 */
export async function fetchPage(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const opts = { timeout: 30_000, ...options };

  // Skip rendering APIs if caller explicitly wants static fetch (e.g. for XML sitemaps)
  if (!opts.forceStaticFetch) {
    // Tier 1: Firecrawl
    const firecrawlResult = await tryFirecrawl(url, opts);
    if (firecrawlResult) return firecrawlResult;

    // Tier 2: Jina
    const jinaResult = await tryJina(url, opts);
    if (jinaResult) return jinaResult;
  }

  // Tier 3: Standard fetch
  const staticResult = await tryStaticFetch(url, opts);

  // Warn if the page looks like it has JS-rendered content we can't see
  if (staticResult.html && (looksLikeEmptySpaShell(staticResult.html) || hasGhostListings(staticResult.html))) {
    console.warn(
      `[scraper] WARNING: ${url} appears to have JS-rendered content that static fetch cannot capture. ` +
      `Configure FIRECRAWL_API_KEY or JINA_API_KEY to enable JavaScript rendering.`
    );
  }

  return staticResult;
}
