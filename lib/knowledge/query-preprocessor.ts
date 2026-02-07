// lib/knowledge/query-preprocessor.ts - Query preprocessing for hybrid RAG
// Handles entity detection, query expansion, and query type classification

export type QueryType = 'entity' | 'conceptual' | 'mixed' | 'unknown';

export interface PreprocessedQuery {
  originalQuery: string;
  expandedQuery: string;
  normalizedQuery: string;
  detectedEntities: DetectedEntity[];
  queryType: QueryType;
  keywords: string[];
}

export interface DetectedEntity {
  type: EntityType;
  value: string;
  normalized: string;
  startIndex: number;
  endIndex: number;
}

export type EntityType =
  | 'address'
  | 'phone'
  | 'email'
  | 'sku'
  | 'price'
  | 'date'
  | 'time'
  | 'url'
  | 'number';

// ============================================
// ENTITY DETECTION PATTERNS
// ============================================

const PATTERNS: Record<EntityType, RegExp> = {
  // US street addresses (e.g., "15 Henry St", "123 Main Street Apt 4B")
  address: /\b\d+\s+[\w\s]+(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Ct|Court|Pl(?:ace)?|Way|Cir(?:cle)?|Terr(?:ace)?|Pkwy|Parkway)\.?(?:\s*(?:#|Apt|Suite|Unit|Ste|Fl|Floor)\s*[\w\d-]+)?\b/gi,

  // Phone numbers (various formats)
  phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

  // Email addresses
  email: /\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/gi,

  // SKU/Product codes (alphanumeric with dashes/underscores)
  sku: /\b[A-Z]{2,}[-_]?\d{3,}(?:[-_]?[A-Z\d]+)*\b/g,

  // Prices (USD)
  price: /\$\d+(?:,\d{3})*(?:\.\d{2})?\b/g,

  // Dates (various formats)
  date: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/gi,

  // Times (12h and 24h)
  time: /\b(?:\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?|\d{1,2}\s*(?:AM|PM|am|pm))\b/g,

  // URLs
  url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,

  // General numbers (for quantities, IDs, etc.)
  number: /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g,
};

// Entity type priorities (higher = detected first, prevents overlaps)
const ENTITY_PRIORITY: EntityType[] = [
  'url',
  'email',
  'phone',
  'address',
  'sku',
  'price',
  'date',
  'time',
  'number',
];

// ============================================
// QUERY EXPANSION TEMPLATES
// ============================================

const EXPANSION_TEMPLATES: Partial<Record<EntityType, string[]>> = {
  address: ['address', 'location', 'property', 'building', 'place'],
  phone: ['phone', 'number', 'contact', 'call', 'telephone'],
  email: ['email', 'contact', 'address', 'mail'],
  price: ['price', 'cost', 'fee', 'rate', 'charge'],
  date: ['date', 'day', 'when', 'schedule'],
  time: ['time', 'hours', 'schedule', 'when', 'open'],
};

// ============================================
// QUESTION WORD PATTERNS (for conceptual queries)
// ============================================

const QUESTION_PATTERNS = [
  /^(?:what|how|why|when|where|who|which|can|could|would|should|do|does|is|are|will)\b/i,
  /\?$/,
  /\b(?:explain|describe|tell me|help me understand)\b/i,
];

const ENTITY_HEAVY_INDICATORS = [
  /\b(?:find|locate|search|look up|looking for)\b/i,
  /\b(?:number|address|email|contact|phone|price|cost)\b/i,
];

// ============================================
// INTENT-BASED EXPANSION (for conceptual queries with no entities)
// ============================================
// When a user asks "do you have anything?" or "I need a place", the query
// has no entities to expand from. These patterns detect INTENT signals
// and inject retrieval-friendly terms so the hybrid search casts a wider net.

interface IntentExpansion {
  pattern: RegExp;
  terms: string[];
}

const INTENT_EXPANSIONS: IntentExpansion[] = [
  // Availability / inventory queries (industry-agnostic)
  {
    pattern: /\b(?:do you have|have any|anything available|what.*(?:available|offer|have)|need (?:a|some|to find)|looking for|searching for|find me|show me|what options)\b/i,
    terms: ['available', 'listing', 'options', 'price', 'catalog', 'inventory'],
  },
  // Pricing / cost queries
  {
    pattern: /\b(?:how much|what.*cost|pricing|rates?|affordable|budget|cheapest|under \$)\b/i,
    terms: ['price', 'cost', 'rate', 'plan', 'fee', 'pricing'],
  },
  // Scheduling / booking queries
  {
    pattern: /\b(?:book|schedule|appointment|reserve|visit|when.*(?:available|open|can i))\b/i,
    terms: ['schedule', 'booking', 'availability', 'appointment', 'calendar'],
  },
  // Features / specifications queries (industry-agnostic)
  {
    pattern: /\b(?:features?|specs?|specifications?|what.*(?:include|come with)|details?|amenities?|capabilities)\b/i,
    terms: ['features', 'details', 'specifications', 'included', 'description'],
  },
];

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Preprocess a query for hybrid search
 * - Detects entities (addresses, phone numbers, etc.)
 * - Expands the query with related terms
 * - Classifies the query type for weight adjustment
 */
export function preprocessQuery(query: string): PreprocessedQuery {
  const trimmedQuery = query.trim();

  // Detect all entities
  const detectedEntities = detectEntities(trimmedQuery);

  // Classify query type
  const queryType = detectQueryType(trimmedQuery, detectedEntities);

  // Expand query based on detected entities
  const expandedQuery = expandQuery(trimmedQuery, detectedEntities);

  // Normalize query for keyword matching
  const normalizedQuery = normalizeQuery(trimmedQuery);

  // Extract important keywords
  const keywords = extractKeywords(trimmedQuery, detectedEntities);

  return {
    originalQuery: trimmedQuery,
    expandedQuery,
    normalizedQuery,
    detectedEntities,
    queryType,
    keywords,
  };
}

/**
 * Detect entities in a query string
 */
export function detectEntities(query: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];
  const coveredRanges: Array<{ start: number; end: number }> = [];

  // Check each pattern in priority order
  for (const entityType of ENTITY_PRIORITY) {
    const pattern = PATTERNS[entityType];
    pattern.lastIndex = 0; // Reset regex state

    let match;
    while ((match = pattern.exec(query)) !== null) {
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;

      // Skip if this range overlaps with already detected entities
      const overlaps = coveredRanges.some(
        range => !(endIndex <= range.start || startIndex >= range.end)
      );

      if (!overlaps) {
        entities.push({
          type: entityType,
          value: match[0],
          normalized: normalizeEntity(match[0], entityType),
          startIndex,
          endIndex,
        });
        coveredRanges.push({ start: startIndex, end: endIndex });
      }
    }
  }

  // Sort by position in query
  return entities.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Detect the type of query for dynamic weight adjustment
 */
export function detectQueryType(
  query: string,
  entities: DetectedEntity[] = []
): QueryType {
  const hasEntities = entities.length > 0;
  const hasHighValueEntities = entities.some(e =>
    ['address', 'phone', 'email', 'sku'].includes(e.type)
  );

  // Check for question patterns
  const isConceptualQuestion = QUESTION_PATTERNS.some(p => p.test(query));

  // Check for entity-lookup indicators
  const isEntityLookup = ENTITY_HEAVY_INDICATORS.some(p => p.test(query));

  // Short queries with entities are likely entity lookups
  const wordCount = query.split(/\s+/).length;
  const isShortEntityQuery = wordCount <= 5 && hasHighValueEntities;

  if (isShortEntityQuery || (hasHighValueEntities && isEntityLookup)) {
    return 'entity';
  }

  if (isConceptualQuestion && !hasHighValueEntities) {
    return 'conceptual';
  }

  if (hasEntities && isConceptualQuestion) {
    return 'mixed';
  }

  if (hasHighValueEntities) {
    return 'entity';
  }

  if (isConceptualQuestion) {
    return 'conceptual';
  }

  return 'unknown';
}

/**
 * Expand a query with related terms for better semantic matching
 */
export function expandQuery(
  query: string,
  entities: DetectedEntity[]
): string {
  const expansions: string[] = [];

  // Entity-based expansion (existing)
  for (const entity of entities) {
    const templates = EXPANSION_TEMPLATES[entity.type];
    if (templates) {
      expansions.push(...templates.slice(0, 2));
    }
  }

  // Intent-based expansion (for conceptual queries without entities)
  // This ensures vague queries like "do you have anything?" still pull in
  // listing/product chunks that contain addresses, prices, etc.
  if (entities.length === 0) {
    for (const intent of INTENT_EXPANSIONS) {
      if (intent.pattern.test(query)) {
        expansions.push(...intent.terms);
        break; // One intent match is enough — avoid over-expansion
      }
    }
  }

  if (expansions.length === 0) {
    return query;
  }

  // Dedupe and exclude words already in the query
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const uniqueExpansions = [...new Set(expansions)].filter(
    (term) => !queryWords.has(term.toLowerCase())
  );

  if (uniqueExpansions.length === 0) {
    return query;
  }

  return `${query} ${uniqueExpansions.join(' ')}`;
}

/**
 * Normalize a query for better keyword matching
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

/**
 * Normalize an entity value for consistent matching
 */
function normalizeEntity(value: string, type: EntityType): string {
  switch (type) {
    case 'phone':
      // Normalize to digits only
      return value.replace(/\D/g, '');

    case 'email':
      return value.toLowerCase();

    case 'address':
      // Normalize common abbreviations
      return value
        .replace(/\bSt\.?\b/gi, 'Street')
        .replace(/\bAve\.?\b/gi, 'Avenue')
        .replace(/\bRd\.?\b/gi, 'Road')
        .replace(/\bBlvd\.?\b/gi, 'Boulevard')
        .replace(/\bDr\.?\b/gi, 'Drive')
        .replace(/\bLn\.?\b/gi, 'Lane')
        .replace(/\bCt\.?\b/gi, 'Court')
        .replace(/\bApt\.?\b/gi, 'Apartment')
        .replace(/\bSte\.?\b/gi, 'Suite')
        .replace(/\bFl\.?\b/gi, 'Floor');

    case 'sku':
      return value.toUpperCase();

    default:
      return value;
  }
}

/**
 * Extract important keywords for keyword search
 */
export function extractKeywords(
  query: string,
  entities: DetectedEntity[]
): string[] {
  // Start with entity values as primary keywords
  const keywords = entities.map(e => e.value);

  // Add significant words from query (excluding stop words)
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
    'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'me', 'my',
    'your', 'his', 'her', 'its', 'our', 'their', 'about', 'into', 'through',
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  keywords.push(...words);

  // Dedupe while preserving order
  return [...new Set(keywords)];
}

/**
 * Generate a ts_query string from keywords
 * Useful for building custom full-text search queries
 */
export function buildTsQuery(keywords: string[], operator: 'AND' | 'OR' = 'OR'): string {
  const op = operator === 'AND' ? ' & ' : ' | ';
  return keywords
    .map(k => k.replace(/[^\w\s]/g, '').trim())
    .filter(k => k.length > 1)
    .join(op);
}

/**
 * Check if a query is likely to benefit from exact match boosting
 */
export function shouldBoostExactMatch(query: string, entities: DetectedEntity[]): boolean {
  // Short queries with specific entities benefit from exact matching
  const wordCount = query.split(/\s+/).length;
  const hasAddressOrSku = entities.some(e => ['address', 'sku', 'phone'].includes(e.type));

  return wordCount <= 6 && hasAddressOrSku;
}
