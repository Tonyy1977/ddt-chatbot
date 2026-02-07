// app/api/knowledge/route.ts - Knowledge source upload API
// Adapted from ai-saas: removed tenantId/agentId (single-tenant DDT chatbot)
import { db, knowledgeSources } from '@/db';
import { eq } from 'drizzle-orm';
import { processDocument, validateFile, getKnowledgeSourceType } from '@/lib/knowledge/processor';
import { requireAuth } from '@/lib/supabase/server';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

/**
 * POST /api/knowledge - Upload a document or add knowledge content
 */
export async function POST(req: Request) {
  try {
    await requireAuth();

    const contentType = req.headers.get('content-type') || '';

    // Handle JSON requests (text, website, qa)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { type, name, content, url } = body;

      if (!type || !['text', 'website', 'qa'].includes(type)) {
        return Response.json(
          { error: 'Invalid type. Must be text, website, or qa' },
          { status: 400 }
        );
      }

      const knowledgeSourceId = `ks_${crypto.randomUUID().slice(0, 12)}`;

      if (type === 'text' || type === 'qa') {
        if (!name || !content) {
          return Response.json(
            { error: 'Name and content are required for text/qa types' },
            { status: 400 }
          );
        }

        const contentSize = new Blob([content]).size;

        // For Q&A type, format the content for better RAG retrieval
        let processableContent = content;
        let qaData = null;

        if (type === 'qa') {
          try {
            qaData = JSON.parse(content);
            const question = qaData.question || '';
            const answer = qaData.answer || '';
            const variations = qaData.variations || [];

            const formattedParts = [
              `Question: ${question}`,
              `Answer: ${answer}`,
            ];

            if (variations.length > 0) {
              formattedParts.push(`Alternative phrasings: ${variations.join(', ')}`);
            }

            processableContent = formattedParts.join('\n\n');
          } catch (e) {
            console.error('Failed to parse Q&A content:', e);
          }
        }

        await db.insert(knowledgeSources).values({
          id: knowledgeSourceId,
          name,
          description: null,
          type,
          status: 'pending',
          metadata: {
            contentSize,
            uploadedAt: new Date().toISOString(),
            ...(qaData ? { qaData } : {}),
          },
        });

        const buffer = Buffer.from(processableContent, 'utf-8');
        const result = await processDocument(
          knowledgeSourceId,
          buffer,
          `${name}.txt`
        );

        if (!result.success) {
          return Response.json(
            { error: 'Content processing failed', details: result.error },
            { status: 500 }
          );
        }

        const [updatedKs] = await db.select()
          .from(knowledgeSources)
          .where(eq(knowledgeSources.id, knowledgeSourceId));

        return Response.json({
          success: true,
          knowledgeSource: {
            id: updatedKs.id,
            name: updatedKs.name,
            type: updatedKs.type,
            status: updatedKs.status,
            metadata: updatedKs.metadata,
          },
          processing: { chunkCount: result.chunkCount },
        });
      }

      if (type === 'website') {
        if (!url) {
          return Response.json(
            { error: 'URL is required for website type' },
            { status: 400 }
          );
        }

        await db.insert(knowledgeSources).values({
          id: knowledgeSourceId,
          name: url,
          description: null,
          type: 'website',
          status: 'pending',
          metadata: {
            url,
            uploadedAt: new Date().toISOString(),
          },
        });

        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
          }

          const html = await response.text();
          const $ = cheerio.load(html);

          // Remove non-content elements
          $('script, style, nav, header, footer, noscript, iframe, svg').remove();
          $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
          $('.nav, .navbar, .menu, .sidebar, .footer, .header, .navigation').remove();
          $('#nav, #navbar, #menu, #sidebar, #footer, #header, #navigation').remove();

          const title = $('title').text().trim() ||
            $('h1').first().text().trim() ||
            $('meta[property="og:title"]').attr('content') ||
            url;

          const contentParts: string[] = [];

          const contentSelectors = [
            'main', 'article', '.entry-content', '.post-content',
            '.page-content', '.content', '#content', '.site-content',
            '[role="main"]', '.elementor-widget-container', '.wp-block-group',
          ];

          let contentRoot: ReturnType<typeof $> = $('body');
          for (const selector of contentSelectors) {
            const found = $(selector);
            if (found.length > 0 && found.text().trim().length > 100) {
              contentRoot = found;
              break;
            }
          }

          contentRoot.find('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption').each((_, el) => {
            const $el = $(el);
            const tagName = el.tagName.toLowerCase();
            const text = $el.text().trim();

            if (!text || text.length < 3) return;

            switch (tagName) {
              case 'h1': contentParts.push(`\n# ${text}\n`); break;
              case 'h2': contentParts.push(`\n## ${text}\n`); break;
              case 'h3': contentParts.push(`\n### ${text}\n`); break;
              case 'h4': case 'h5': case 'h6': contentParts.push(`\n#### ${text}\n`); break;
              case 'li': contentParts.push(`- ${text}`); break;
              case 'blockquote': contentParts.push(`> ${text}`); break;
              default: contentParts.push(text);
            }
          });

          let textContent = contentParts.join('\n').trim();

          if (textContent.length < 100) {
            textContent = $('body').text().replace(/\s+/g, ' ').trim();
          }

          textContent = textContent
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();

          const contentSize = new Blob([textContent]).size;

          await db.update(knowledgeSources)
            .set({
              name: title,
              metadata: {
                url,
                contentSize,
                uploadedAt: new Date().toISOString(),
              },
            })
            .where(eq(knowledgeSources.id, knowledgeSourceId));

          const buffer = Buffer.from(textContent, 'utf-8');
          const result = await processDocument(
            knowledgeSourceId,
            buffer,
            `${title}.txt`
          );

          if (!result.success) {
            throw new Error(result.error);
          }

          const [updatedKs] = await db.select()
            .from(knowledgeSources)
            .where(eq(knowledgeSources.id, knowledgeSourceId));

          return Response.json({
            success: true,
            title,
            knowledgeSource: {
              id: updatedKs.id,
              name: updatedKs.name,
              type: updatedKs.type,
              status: updatedKs.status,
              metadata: updatedKs.metadata,
            },
            processing: { chunkCount: result.chunkCount },
          });
        } catch (fetchError) {
          await db.update(knowledgeSources)
            .set({ status: 'error' })
            .where(eq(knowledgeSources.id, knowledgeSourceId));

          return Response.json(
            { error: 'Failed to fetch website', details: (fetchError as Error).message },
            { status: 400 }
          );
        }
      }
    }

    // Handle FormData requests (file uploads)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const validation = validateFile({ size: file.size, name: file.name });
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const knowledgeSourceId = `ks_${crypto.randomUUID().slice(0, 12)}`;
    const sourceType = getKnowledgeSourceType(file.name);

    await db.insert(knowledgeSources).values({
      id: knowledgeSourceId,
      name: name || file.name,
      description: null,
      type: sourceType,
      status: 'pending',
      metadata: {
        originalFileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processDocument(knowledgeSourceId, buffer, file.name);

    if (!result.success) {
      return Response.json(
        { error: 'Document processing failed', details: result.error, knowledgeSourceId },
        { status: 500 }
      );
    }

    const [updatedKs] = await db.select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    return Response.json({
      success: true,
      knowledgeSource: {
        id: updatedKs.id,
        name: updatedKs.name,
        type: updatedKs.type,
        status: updatedKs.status,
        metadata: updatedKs.metadata,
      },
      processing: { chunkCount: result.chunkCount },
    });

  } catch (error) {
    console.error('Knowledge upload error:', error);
    return Response.json(
      { error: 'Failed to process upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge - List knowledge sources
 */
export async function GET() {
  try {
    await requireAuth();

    const sources = await db.select()
      .from(knowledgeSources);

    return Response.json({
      knowledgeSources: sources.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.type,
        status: s.status,
        metadata: s.metadata,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });

  } catch (error) {
    console.error('Knowledge list error:', error);
    return Response.json(
      { error: 'Failed to list knowledge sources' },
      { status: 500 }
    );
  }
}
