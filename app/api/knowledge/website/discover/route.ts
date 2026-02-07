// app/api/knowledge/website/discover/route.ts - Website Discovery API
// Simplified version: basic crawl discovery without external crawler lib
import { requireAuth } from '@/lib/supabase/server';
import * as cheerio from 'cheerio';

export const maxDuration = 30;

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

/**
 * POST /api/knowledge/website/discover
 * Discover URLs from a website
 */
export async function POST(req: Request) {
  try {
    await requireAuth();

    const body = await req.json();
    const { url, mode } = body;

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!mode || !['single', 'crawl', 'sitemap'].includes(mode)) {
      return Response.json(
        { error: 'Invalid mode. Must be single, crawl, or sitemap' },
        { status: 400 }
      );
    }

    let validUrl: string;
    try {
      validUrl = normalizeUrl(url);
      new URL(validUrl);
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const parsedUrl = new URL(validUrl);
    const domain = parsedUrl.hostname;

    if (mode === 'single') {
      return Response.json({
        urls: [{ url: validUrl, title: validUrl, depth: 0 }],
        domain,
        baseUrl: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
      });
    }

    // Crawl or sitemap mode: discover links
    const discoveredUrls: { url: string; title?: string; depth: number }[] = [];
    const visited = new Set<string>();
    const errors: string[] = [];

    try {
      if (mode === 'sitemap') {
        // Try to fetch sitemap.xml
        const sitemapUrl = validUrl.endsWith('.xml')
          ? validUrl
          : `${parsedUrl.protocol}//${parsedUrl.hostname}/sitemap.xml`;

        const res = await fetch(sitemapUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)' },
        });

        if (res.ok) {
          const xml = await res.text();
          const $ = cheerio.load(xml, { xml: true });
          $('url > loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc && !visited.has(loc) && discoveredUrls.length < 100) {
              visited.add(loc);
              discoveredUrls.push({ url: loc, depth: 0 });
            }
          });
          // Handle sitemap index
          $('sitemap > loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc && !visited.has(loc) && discoveredUrls.length < 100) {
              visited.add(loc);
              discoveredUrls.push({ url: loc, depth: 0 });
            }
          });
        } else {
          errors.push(`Sitemap not found at ${sitemapUrl} (${res.status})`);
        }
      } else {
        // Crawl mode: fetch page and extract links
        const res = await fetch(validUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)' },
        });

        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);

          visited.add(validUrl);
          discoveredUrls.push({ url: validUrl, title: $('title').text().trim() || validUrl, depth: 0 });

          $('a[href]').each((_, el) => {
            if (discoveredUrls.length >= 100) return;

            const href = $(el).attr('href');
            if (!href) return;

            try {
              const linkUrl = new URL(href, validUrl);
              // Only same domain
              if (linkUrl.hostname !== domain) return;
              // Skip anchors, mailto, tel
              if (linkUrl.protocol !== 'http:' && linkUrl.protocol !== 'https:') return;

              const normalized = `${linkUrl.protocol}//${linkUrl.hostname}${linkUrl.pathname}`;
              if (visited.has(normalized)) return;

              visited.add(normalized);
              discoveredUrls.push({
                url: normalized,
                title: $(el).text().trim() || normalized,
                depth: 1,
              });
            } catch {
              // Skip invalid URLs
            }
          });
        } else {
          errors.push(`Failed to fetch page: ${res.status}`);
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Discovery failed');
    }

    return Response.json({
      urls: discoveredUrls,
      domain,
      baseUrl: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
      errors: errors.length ? errors : undefined,
    });

  } catch (error) {
    console.error('Discovery error:', error);
    return Response.json(
      { error: 'Discovery failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
