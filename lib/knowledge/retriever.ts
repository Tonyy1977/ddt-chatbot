// lib/knowledge/retriever.ts - Hybrid Search for RAG (Vector + Keyword)
// Adapted from ai-saas: removed tenantId/agentId (single-tenant DDT chatbot)
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { generateQueryEmbedding } from './embeddings';
import { preprocessQuery, detectQueryType, QueryType } from './query-preprocessor';

// Local types (simplified from ai-saas @/types)
export interface RagQueryResult {
  chunkId: string;
  knowledgeSourceId: string;
  knowledgeSourceName: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface RagContext {
  chunks: RagQueryResult[];
  totalTokensEstimate: number;
}

interface RetrievalOptions {
  topK?: number;
  knowledgeSourceIds?: string[];
  vectorWeight?: number;
  keywordWeight?: number;
  searchMode?: 'hybrid' | 'vector' | 'keyword';
}

const DEFAULT_OPTIONS = {
  topK: 5,
  vectorWeight: 0.6,
  keywordWeight: 0.4,
  searchMode: 'hybrid' as const,
};

const WEIGHT_PRESETS: Record<QueryType, { vector: number; keyword: number }> = {
  entity: { vector: 0.3, keyword: 0.7 },
  conceptual: { vector: 0.8, keyword: 0.2 },
  mixed: { vector: 0.5, keyword: 0.5 },
  unknown: { vector: 0.6, keyword: 0.4 },
};

/**
 * Retrieve relevant chunks using HYBRID search (Vector + Keyword)
 * Uses Reciprocal Rank Fusion (RRF) to combine results
 */
export async function retrieveContext(
  query: string,
  options: RetrievalOptions = {}
): Promise<RagContext> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log('========== RAG HYBRID RETRIEVAL DEBUG ==========');
  console.log(`Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);

  const { expandedQuery, detectedEntities, queryType } = preprocessQuery(query);

  if (!options.vectorWeight && !options.keywordWeight) {
    const preset = WEIGHT_PRESETS[queryType];
    opts.vectorWeight = preset.vector;
    opts.keywordWeight = preset.keyword;
  }

  console.log(`Query Type: ${queryType}`);
  console.log(`Detected Entities: ${detectedEntities.length > 0 ? detectedEntities.join(', ') : 'none'}`);
  console.log(`Weights: vector=${opts.vectorWeight}, keyword=${opts.keywordWeight}`);
  console.log(`Options: topK=${opts.topK}, mode=${opts.searchMode}`);

  const queryEmbedding = await generateQueryEmbedding(expandedQuery);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  let results;

  if (opts.searchMode === 'hybrid') {
    try {
      results = await executeHybridSearch(query, embeddingStr, opts);
    } catch (hybridErr) {
      // Hybrid may fail if search_vector is text instead of tsvector
      // (migration 001_setup_vector.sql not yet applied). Fall back to vector-only.
      console.warn('Hybrid search failed, falling back to vector-only:', (hybridErr as Error).message?.slice(0, 120));
      results = await executeVectorOnlySearch(embeddingStr, opts);
    }
  } else if (opts.searchMode === 'keyword') {
    results = await executeKeywordOnlySearch(query, opts);
  } else {
    results = await executeVectorOnlySearch(embeddingStr, opts);
  }

  console.log(`\n[DEBUG] Raw results from DB: ${results.rows.length} chunks`);

  if (results.rows.length > 0) {
    console.log('[DEBUG] Top chunks:');
    (results.rows as any[]).slice(0, 5).forEach((row, i) => {
      const rrfScore = parseFloat(row.rrf_score || 0);
      const vectorScore = row.vector_score ? parseFloat(row.vector_score).toFixed(3) : 'N/A';
      const keywordScore = row.keyword_score ? parseFloat(row.keyword_score).toFixed(3) : 'N/A';
      console.log(`  ${i + 1}. RRF: ${rrfScore.toFixed(6)} (V:${vectorScore}, K:${keywordScore}) | ${row.knowledge_source_name}`);
      console.log(`     "${row.content.substring(0, 80)}..."`);
    });
  }

  const topRows = (results.rows as any[]).slice(0, opts.topK);

  console.log(`\n[DEBUG] Using top ${topRows.length} of ${results.rows.length} results`);

  const chunks: RagQueryResult[] = topRows.map((row) => ({
    chunkId: row.chunk_id || row.id,
    knowledgeSourceId: row.knowledge_source_id,
    knowledgeSourceName: row.knowledge_source_name,
    content: row.content,
    score: parseFloat(row.rrf_score || 0),
    metadata: row.metadata,
  }));

  const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0);

  console.log(`\n[DEBUG] Final: ${chunks.length} chunks, ~${Math.ceil(totalChars / 4)} tokens`);
  if (chunks.length === 0) {
    console.log('[DEBUG] NO RELEVANT CONTEXT FOUND!');
  }
  console.log('==========================================\n');

  return {
    chunks,
    totalTokensEstimate: Math.ceil(totalChars / 4),
  };
}

/**
 * Execute hybrid search using Reciprocal Rank Fusion (RRF)
 */
async function executeHybridSearch(
  query: string,
  embeddingStr: string,
  opts: RetrievalOptions & { topK: number; vectorWeight: number; keywordWeight: number }
) {
  const tsQueryText = query.trim();
  const k = 60; // RRF constant
  const fetchLimit = opts.topK * 4;

  return db.execute(sql`
    WITH vector_results AS (
      SELECT
        dc.id,
        dc.content,
        dc.metadata,
        dc.knowledge_source_id,
        ks.name as knowledge_source_name,
        ks.type as knowledge_source_type,
        1 - (dc.embedding::vector(1536) <=> ${embeddingStr}::vector(1536)) as vector_score,
        ROW_NUMBER() OVER (
          ORDER BY dc.embedding::vector(1536) <=> ${embeddingStr}::vector(1536)
        ) as vector_rank
      FROM document_chunks dc
      INNER JOIN knowledge_sources ks ON dc.knowledge_source_id = ks.id
      WHERE ks.status = 'ready'
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding::vector(1536) <=> ${embeddingStr}::vector(1536)
      LIMIT ${fetchLimit}
    ),
    keyword_results AS (
      SELECT
        dc.id,
        dc.content,
        dc.metadata,
        dc.knowledge_source_id,
        ks.name as knowledge_source_name,
        ks.type as knowledge_source_type,
        ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', ${tsQueryText}), 32) as keyword_score,
        ROW_NUMBER() OVER (
          ORDER BY ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', ${tsQueryText}), 32) DESC
        ) as keyword_rank
      FROM document_chunks dc
      INNER JOIN knowledge_sources ks ON dc.knowledge_source_id = ks.id
      WHERE ks.status = 'ready'
        AND dc.search_vector IS NOT NULL
        AND dc.search_vector @@ websearch_to_tsquery('english', ${tsQueryText})
      ORDER BY keyword_score DESC
      LIMIT ${fetchLimit}
    ),
    combined AS (
      SELECT
        COALESCE(v.id, k.id) as chunk_id,
        COALESCE(v.content, k.content) as content,
        COALESCE(v.metadata, k.metadata) as metadata,
        COALESCE(v.knowledge_source_id, k.knowledge_source_id) as knowledge_source_id,
        COALESCE(v.knowledge_source_name, k.knowledge_source_name) as knowledge_source_name,
        COALESCE(v.knowledge_source_type, k.knowledge_source_type) as knowledge_source_type,
        COALESCE(v.vector_score, 0) as vector_score,
        COALESCE(k.keyword_score, 0) as keyword_score,
        (
          ${opts.vectorWeight} * COALESCE(1.0 / (${k} + v.vector_rank), 0) +
          ${opts.keywordWeight} * COALESCE(1.0 / (${k} + k.keyword_rank), 0)
        ) as rrf_score
      FROM vector_results v
      FULL OUTER JOIN keyword_results k ON v.id = k.id
    )
    SELECT *
    FROM combined
    WHERE rrf_score > 0
    ORDER BY rrf_score DESC
    LIMIT ${opts.topK}
  `);
}

/**
 * Fallback: Vector-only search
 */
async function executeVectorOnlySearch(
  embeddingStr: string,
  opts: RetrievalOptions & { topK: number }
) {
  return db.execute(sql`
    SELECT
      dc.id as chunk_id,
      dc.knowledge_source_id,
      dc.content,
      dc.metadata,
      ks.name as knowledge_source_name,
      ks.type as knowledge_source_type,
      1 - (dc.embedding::vector(1536) <=> ${embeddingStr}::vector(1536)) as vector_score,
      1 - (dc.embedding::vector(1536) <=> ${embeddingStr}::vector(1536)) as rrf_score
    FROM document_chunks dc
    INNER JOIN knowledge_sources ks ON dc.knowledge_source_id = ks.id
    WHERE ks.status = 'ready'
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding::vector(1536) <=> ${embeddingStr}::vector(1536)
    LIMIT ${opts.topK}
  `);
}

/**
 * Fallback: Keyword-only search
 */
async function executeKeywordOnlySearch(
  query: string,
  opts: RetrievalOptions & { topK: number }
) {
  const tsQueryText = query.trim();

  return db.execute(sql`
    SELECT
      dc.id as chunk_id,
      dc.knowledge_source_id,
      dc.content,
      dc.metadata,
      ks.name as knowledge_source_name,
      ks.type as knowledge_source_type,
      ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', ${tsQueryText}), 32) as keyword_score,
      ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', ${tsQueryText}), 32) as rrf_score
    FROM document_chunks dc
    INNER JOIN knowledge_sources ks ON dc.knowledge_source_id = ks.id
    WHERE ks.status = 'ready'
      AND dc.search_vector @@ websearch_to_tsquery('english', ${tsQueryText})
    ORDER BY keyword_score DESC
    LIMIT ${opts.topK}
  `);
}

/**
 * Format retrieved context for inclusion in system prompt
 */
export function formatContextForPrompt(context: RagContext): string {
  if (context.chunks.length === 0) {
    return '';
  }

  const sections = context.chunks.map((chunk, i) => {
    const page = chunk.metadata?.pageNumber ? ` (Page ${chunk.metadata.pageNumber})` : '';
    return `[ref-${i + 1}${page}]\n${chunk.content}`;
  });

  const hasLinks = context.chunks.some(c => /\[.+?\]\(https?:\/\/.+?\)/.test(c.content));

  const linkHunterDirective = hasLinks
    ? `
### Link Surfacing & Classification (IMPORTANT)
The retrieved context contains Markdown links in the format [Text](URL).
You MUST follow these rules:

**Step 1: Classify every link by its purpose.**
Use the anchor text inside the brackets first. If no anchor text exists,
fall back to URL keywords.

| Category | Anchor text contains | URL fallback contains |
|---|---|---|
| **Action Link** (apply, sign up, purchase) | "Apply", "Application", "Start", "Sign Up", "Register", "Enroll", "Purchase", "Order" | \`/apply\`, \`/application\`, \`/signup\`, \`/register\`, \`managebuilding\` |
| **Booking Link** (explore, tour, demo) | "Schedule", "Tour", "Book", "Calendar", "Visit", "Demo", "Consultation" | \`/schedule\`, \`/tour\`, \`/book\`, \`calendly\`, \`/demo\` |
| **Info Link** (learn more) | "Learn", "Details", "More Info", "Contact", "Pricing", "FAQ" | \`/contact\`, \`/pricing\`, \`/faq\`, \`/about\` |

**Step 2: Present links with clear separation.**
When your response includes links from different categories, separate
them so the user understands the difference between commitment and
exploration:

Format:
  **Interested? → [Schedule a Tour](URL)**
  **Ready to commit? → [Apply Now](URL)**

- NEVER lump Action Links and Booking Links into a single sentence.
- Present Booking/Exploration links FIRST, then Action/Commitment links.

**Step 3: General rules.**
- After answering, scan every retrieved source for links relevant to the
  user's current question or implied intent.
- NEVER fabricate, guess, or modify a URL. Only use links that appear
  verbatim in the retrieved context below.
- If multiple links are relevant, show up to 3, ordered by relevance.
- If no link is relevant to the current question, do not force one.`
    : `
### Contact Info Safety Net
No clickable links were found in the retrieved sources. However, the
sources may still contain phone numbers, email addresses, or physical
addresses. When the user needs to take an action (apply, book, visit,
purchase) and no direct link is available:
1. Look for any phone number, email, or street address in the sources.
2. Present the contact info as YOUR OWN — you are part of this team.
   Always use first-person: "our", "us", "we".
   NEVER use third-person: "them", "they", "the company", "the landlord",
   "the team", or the business name as a separate entity.
3. NEVER fabricate contact info. Only use what appears verbatim in the
   retrieved sources below.
4. If no contact info exists either, say warmly:
   "I don't have a direct link for that, but I'd love to help you
   get connected. Please visit our website or reach out to our team
   and we'll take care of you."`;

  return `<knowledge_base>

### Grounding Rules (Anti-Hallucination)
You are operating in RAG (Retrieval-Augmented Generation) mode.
You MUST follow these rules strictly:
1. Base your answer ONLY on the retrieved sources below.
   Do not use prior training knowledge to answer factual questions about
   the product, its pricing, policies, or features.
2. If the answer is NOT contained in the sources below, say:
   "I don't have that information in my knowledge base. Please contact
   our team for help with this."
   Do NOT guess, speculate, or fill in gaps with plausible-sounding info.
3. NEVER fabricate URLs, email addresses, phone numbers, or prices.
   Only quote these if they appear verbatim in a source below.
4. NEVER cite or mention source names, source numbers, file names, or
   document titles in your response. The user does not know about your
   knowledge base. Just answer naturally as if you already know the info.

### Data Conflict Resolution (CRITICAL)
The sources below may contain CONTRADICTIONS. When this happens:

**RULE: Specific data ALWAYS overrides generic statements.**

- If the sources contain a list of items with concrete details (names,
  prices, addresses, dates, descriptions), those items ARE the truth.
  IGNORE any generic banner, header, or disclaimer that says otherwise.
- If an item appears with details (price, description, ID), treat it
  as AVAILABLE unless that specific item is individually marked as
  "Sold", "Booked", "Unavailable", or "Discontinued".
- NEVER open your response with a generic negative if the sources
  contain specific items. Present the specific data directly.
${linkHunterDirective}

---
Retrieved Context:

${sections.join('\n\n---\n\n')}

</knowledge_base>`;
}

/**
 * Augment system prompt with retrieved context
 */
export function augmentSystemPrompt(
  originalPrompt: string,
  context: RagContext
): string {
  const contextStr = formatContextForPrompt(context);
  if (!contextStr) return originalPrompt;

  return `${originalPrompt}

${contextStr}`;
}

/**
 * Extract RAG metadata for message storage
 */
export function extractRagMetadata(context: RagContext) {
  return context.chunks.map((chunk) => ({
    knowledgeSourceId: chunk.knowledgeSourceId,
    knowledgeSourceName: chunk.knowledgeSourceName,
    chunkId: chunk.chunkId,
    score: chunk.score,
    pageNumber: chunk.metadata?.pageNumber,
  }));
}

/**
 * Extract user's query from the last message
 */
export function extractUserQuery(messages: Array<{ role: string; content?: string }>): string {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) return '';
  return lastUserMessage.content || '';
}
