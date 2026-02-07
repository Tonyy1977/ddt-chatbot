// lib/knowledge/chunker.ts - Enhanced semantic text chunking for RAG
// Includes entity-aware smart chunking to preserve addresses, phone numbers, etc.

export interface TextChunk {
  content: string;
  metadata: {
    chunkIndex: number;
    startChar: number;
    endChar: number;
    pageNumber?: number;
    containsEntities?: string[]; // Types of entities found in this chunk
  };
}

export interface ChunkOptions {
  maxChunkSize?: number;      // Max characters per chunk (default: 1000)
  chunkOverlap?: number;      // Overlap between chunks (default: 200)
  minChunkSize?: number;      // Minimum chunk size (default: 100)
}

export interface SmartChunkOptions extends ChunkOptions {
  preserveEntities?: boolean; // Enable entity preservation (default: true)
  entityPadding?: number;     // Extra chars to include around entities (default: 50)
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
};

const SMART_DEFAULTS: Required<SmartChunkOptions> = {
  ...DEFAULT_OPTIONS,
  preserveEntities: true,
  entityPadding: 50,
};

// ============================================
// ENTITY PATTERNS FOR CHUNKING
// ============================================

// These patterns identify content that should never be split
const ENTITY_PATTERNS: Record<string, RegExp> = {
  // US street addresses
  address: /\b\d+\s+[\w\s]+(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Ct|Court|Pl(?:ace)?|Way|Cir(?:cle)?|Terr(?:ace)?|Pkwy|Parkway)\.?(?:\s*(?:#|Apt|Suite|Unit|Ste|Fl|Floor)\s*[\w\d-]+)?(?:\s*,\s*[\w\s]+)?(?:\s*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/gi,

  // Phone numbers (various formats)
  phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext|x|extension)\.?\s*\d+)?/gi,

  // Email addresses
  email: /\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/gi,

  // URLs (full)
  url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,

  // Prices with context
  price: /\$\d+(?:,\d{3})*(?:\.\d{2})?(?:\s*[-–]\s*\$\d+(?:,\d{3})*(?:\.\d{2})?)?(?:\s*(?:per|\/)\s*(?:hour|hr|day|week|month|year|mo|yr|night|person|unit|sq\s*ft))?/gi,

  // Time ranges
  timeRange: /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/gi,

  // Date ranges
  dateRange: /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?\s*[-–to]+\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\s*[-–to]+\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/gi,

  // SKU/Product codes
  sku: /\b(?:SKU|Item|Product|Model|Part)?\s*[#:]?\s*[A-Z]{2,}[-_]?\d{3,}(?:[-_]?[A-Z\d]+)*/gi,

  // List items (preserve numbered/bulleted lists)
  listItem: /^(?:\d+\.|[-•*])\s+.+$/gm,
};

// Sentence boundary patterns (for smart splitting)
const SENTENCE_END = /[.!?]\s+(?=[A-Z])/g;
const PARAGRAPH_BREAK = /\n\n+/g;

// ============================================
// BASIC CHUNKING FUNCTIONS
// ============================================

/**
 * Estimate tokens from character count (rough approximation)
 * GPT models: ~4 chars per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Character-based chunking with overlap
 */
export function chunkByCharacters(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  let startChar = 0;
  let chunkIndex = 0;

  while (startChar < text.length) {
    let endChar = startChar + opts.maxChunkSize;

    // Don't cut words in the middle
    if (endChar < text.length) {
      const lastSpace = text.lastIndexOf(' ', endChar);
      if (lastSpace > startChar + opts.minChunkSize) {
        endChar = lastSpace;
      }
    } else {
      endChar = text.length;
    }

    const content = text.slice(startChar, endChar).trim();

    if (content.length >= opts.minChunkSize) {
      chunks.push({
        content,
        metadata: {
          chunkIndex,
          startChar,
          endChar,
        },
      });
      chunkIndex++;
    }

    // Move start with overlap
    startChar = endChar - opts.chunkOverlap;
    if (startChar >= text.length) break;
  }

  return chunks;
}

/**
 * Paragraph-based chunking (splits on double newlines)
 */
export function chunkByParagraphs(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const paragraphs = text.split(/\n\n+/);
  const chunks: TextChunk[] = [];

  let currentChunk = '';
  let chunkStartChar = 0;
  let currentStartChar = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) {
      currentStartChar += para.length + 2;
      continue;
    }

    // If adding this paragraph exceeds max, save current and start new
    if (currentChunk && (currentChunk.length + trimmedPara.length + 2) > opts.maxChunkSize) {
      if (currentChunk.length >= opts.minChunkSize) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            chunkIndex,
            startChar: chunkStartChar,
            endChar: currentStartChar,
          },
        });
        chunkIndex++;
      }
      currentChunk = trimmedPara;
      chunkStartChar = currentStartChar;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmedPara}` : trimmedPara;
      if (!chunks.length && !currentChunk.includes('\n\n')) {
        chunkStartChar = currentStartChar;
      }
    }

    currentStartChar += para.length + 2;
  }

  // Don't forget the last chunk
  if (currentChunk.length >= opts.minChunkSize) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        chunkIndex,
        startChar: chunkStartChar,
        endChar: text.length,
      },
    });
  }

  return chunks;
}

/**
 * Section-based chunking (splits on headers: #, ##, etc.)
 */
export function chunkBySections(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sections = text.split(/(?=^#{1,6}\s)/m);
  const chunks: TextChunk[] = [];

  let currentStartChar = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section.trim()) {
      currentStartChar += section.length;
      continue;
    }

    // If section is too large, sub-chunk it
    if (section.length > opts.maxChunkSize) {
      const subChunks = chunkByParagraphs(section, opts);
      for (const subChunk of subChunks) {
        chunks.push({
          content: subChunk.content,
          metadata: {
            chunkIndex: chunks.length,
            startChar: currentStartChar + subChunk.metadata.startChar,
            endChar: currentStartChar + subChunk.metadata.endChar,
          },
        });
      }
    } else if (section.length >= opts.minChunkSize) {
      chunks.push({
        content: section.trim(),
        metadata: {
          chunkIndex: chunks.length,
          startChar: currentStartChar,
          endChar: currentStartChar + section.length,
        },
      });
    }

    currentStartChar += section.length;
  }

  return chunks;
}

// ============================================
// SMART CHUNKING (Entity-Aware)
// ============================================

interface EntityMarker {
  marker: string;
  original: string;
  type: string;
  index: number;
}

/**
 * Smart paragraph chunking that preserves entity integrity
 * Addresses, phone numbers, emails, etc. will never be split across chunks
 */
export function chunkSmartParagraphs(
  text: string,
  options: SmartChunkOptions = {}
): TextChunk[] {
  const opts = { ...SMART_DEFAULTS, ...options };

  if (!opts.preserveEntities) {
    return chunkByParagraphs(text, opts);
  }

  // Step 1: Identify all entities and their positions
  const entityPositions = findEntityPositions(text);

  // Step 2: Find safe split points (paragraph breaks not inside entities)
  const safeSplitPoints = findSafeSplitPoints(text, entityPositions, opts);

  // Step 3: Create chunks at safe points
  const chunks = createChunksAtSafePoints(text, safeSplitPoints, entityPositions, opts);

  return chunks;
}

/**
 * Smart section chunking that preserves entity integrity
 */
export function chunkSmartSections(
  text: string,
  options: SmartChunkOptions = {}
): TextChunk[] {
  const opts = { ...SMART_DEFAULTS, ...options };

  if (!opts.preserveEntities) {
    return chunkBySections(text, opts);
  }

  // Split on headers first
  const sections = text.split(/(?=^#{1,6}\s)/m);
  const chunks: TextChunk[] = [];
  let currentStartChar = 0;

  for (const section of sections) {
    if (!section.trim()) {
      currentStartChar += section.length;
      continue;
    }

    if (section.length > opts.maxChunkSize) {
      // Sub-chunk large sections with entity awareness
      const subChunks = chunkSmartParagraphs(section, opts);
      for (const subChunk of subChunks) {
        chunks.push({
          content: subChunk.content,
          metadata: {
            chunkIndex: chunks.length,
            startChar: currentStartChar + subChunk.metadata.startChar,
            endChar: currentStartChar + subChunk.metadata.endChar,
            containsEntities: subChunk.metadata.containsEntities,
          },
        });
      }
    } else if (section.length >= opts.minChunkSize) {
      const entityTypes = findEntityTypesInText(section);
      chunks.push({
        content: section.trim(),
        metadata: {
          chunkIndex: chunks.length,
          startChar: currentStartChar,
          endChar: currentStartChar + section.length,
          containsEntities: entityTypes.length > 0 ? entityTypes : undefined,
        },
      });
    }

    currentStartChar += section.length;
  }

  return chunks;
}

/**
 * Find all entity positions in text
 */
function findEntityPositions(text: string): Array<{ start: number; end: number; type: string; value: string }> {
  const positions: Array<{ start: number; end: number; type: string; value: string }> = [];
  const covered = new Set<number>();

  for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check for overlap with existing entities
      let overlaps = false;
      for (let i = start; i < end; i++) {
        if (covered.has(i)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        positions.push({ start, end, type, value: match[0] });
        for (let i = start; i < end; i++) {
          covered.add(i);
        }
      }
    }
  }

  return positions.sort((a, b) => a.start - b.start);
}

/**
 * Find safe points to split text (avoiding entity boundaries)
 */
function findSafeSplitPoints(
  text: string,
  entityPositions: Array<{ start: number; end: number }>,
  opts: Required<SmartChunkOptions>
): number[] {
  const safePoints: number[] = [0]; // Start is always safe

  // Find all paragraph breaks
  const paragraphBreaks: number[] = [];
  const breakPattern = /\n\n+/g;
  let match;

  while ((match = breakPattern.exec(text)) !== null) {
    paragraphBreaks.push(match.index + match[0].length);
  }

  // Filter to only safe breaks (not inside entities)
  for (const breakPoint of paragraphBreaks) {
    const isSafe = !entityPositions.some(
      entity =>
        breakPoint > entity.start - opts.entityPadding &&
        breakPoint < entity.end + opts.entityPadding
    );

    if (isSafe) {
      safePoints.push(breakPoint);
    }
  }

  safePoints.push(text.length); // End is always safe
  return safePoints;
}

/**
 * Create chunks using safe split points
 */
function createChunksAtSafePoints(
  text: string,
  safePoints: number[],
  entityPositions: Array<{ start: number; end: number; type: string; value: string }>,
  opts: Required<SmartChunkOptions>
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkStart = 0;
  let chunkContent = '';

  for (let i = 1; i < safePoints.length; i++) {
    const segmentEnd = safePoints[i];
    const segment = text.slice(safePoints[i - 1], segmentEnd);

    // Check if adding this segment exceeds max size
    if (chunkContent && (chunkContent.length + segment.length) > opts.maxChunkSize) {
      // Save current chunk if it meets minimum size
      if (chunkContent.trim().length >= opts.minChunkSize) {
        const entityTypes = findEntityTypesInRange(entityPositions, chunkStart, chunkStart + chunkContent.length);
        chunks.push({
          content: chunkContent.trim(),
          metadata: {
            chunkIndex: chunks.length,
            startChar: chunkStart,
            endChar: chunkStart + chunkContent.length,
            containsEntities: entityTypes.length > 0 ? entityTypes : undefined,
          },
        });
      }
      chunkStart = safePoints[i - 1];
      chunkContent = segment;
    } else {
      chunkContent += segment;
    }
  }

  // Don't forget the last chunk
  if (chunkContent.trim().length >= opts.minChunkSize) {
    const entityTypes = findEntityTypesInRange(entityPositions, chunkStart, chunkStart + chunkContent.length);
    chunks.push({
      content: chunkContent.trim(),
      metadata: {
        chunkIndex: chunks.length,
        startChar: chunkStart,
        endChar: text.length,
        containsEntities: entityTypes.length > 0 ? entityTypes : undefined,
      },
    });
  }

  return chunks;
}

/**
 * Find entity types within a text range
 */
function findEntityTypesInRange(
  entityPositions: Array<{ start: number; end: number; type: string }>,
  rangeStart: number,
  rangeEnd: number
): string[] {
  const types = new Set<string>();

  for (const entity of entityPositions) {
    if (entity.start >= rangeStart && entity.end <= rangeEnd) {
      types.add(entity.type);
    }
  }

  return Array.from(types);
}

/**
 * Find all entity types present in a text
 */
function findEntityTypesInText(text: string): string[] {
  const types: string[] = [];

  for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      types.push(type);
    }
  }

  return types;
}

// ============================================
// Q&A-AWARE CHUNKING
// ============================================

// Matches lines that start a new Question. Captures the question text.
// Supports: "Q:", "Question:", "Q.", "**Q:**", "### Q:" and numbered variants
// like "1. Q:" or "Q1:" or "Question 1:"
const QA_QUESTION_START = /^(?:#{1,4}\s*)?(?:\*{0,2})(?:(?:Q|Question)\s*\d*\s*[:.)]\s*\*{0,2})/im;

// Splits text into Q&A boundary segments. Each match is the start of a new question.
const QA_SPLIT_PATTERN = /\n(?=(?:#{1,4}\s*)?(?:\*{0,2})(?:(?:Q|Question)\s*\d*\s*[:.)]\s*))/gi;

/**
 * Detect whether text contains Q&A-structured content.
 * Returns true if at least 2 Q&A pairs are detected.
 */
export function detectQAStructure(text: string): boolean {
  const matches = text.match(
    /^(?:#{1,4}\s*)?(?:\*{0,2})(?:Q|Question)\s*\d*\s*[:.)]\s*/gim
  );
  return (matches?.length ?? 0) >= 2;
}

/**
 * Q&A-aware chunking: each Question + Answer stays in one atomic chunk.
 *
 * Hard rule: a Q+A pair is NEVER split across chunks. If a single pair
 * exceeds maxChunkSize, we keep it intact (the embedding model can
 * handle up to 8191 tokens for text-embedding-3-small; 1000 chars is
 * only ~250 tokens, so oversized pairs are rare and acceptable).
 *
 * For text that doesn't match Q&A patterns, falls back to paragraph chunking.
 */
export function chunkByQAPairs(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options, minChunkSize: Math.min(options.minChunkSize ?? 10, 10) };

  // Split on question boundaries
  const rawSegments = text.split(QA_SPLIT_PATTERN);
  const chunks: TextChunk[] = [];

  let charOffset = 0;

  for (const segment of rawSegments) {
    const trimmed = segment.trim();
    if (!trimmed) {
      charOffset += segment.length;
      continue;
    }

    // If this segment starts with a Q marker, it's a Q&A unit — keep atomic.
    // If it doesn't (e.g. a preamble before the first Q:), treat as a normal paragraph.
    if (QA_QUESTION_START.test(trimmed)) {
      // Atomic Q&A chunk — never split even if oversized
      chunks.push({
        content: trimmed,
        metadata: {
          chunkIndex: chunks.length,
          startChar: charOffset,
          endChar: charOffset + segment.length,
          containsEntities: ['qa_pair'],
        },
      });
    } else if (trimmed.length >= opts.minChunkSize) {
      // Preamble / non-QA text — use standard paragraph chunking
      const subChunks = chunkByParagraphs(trimmed, opts);
      for (const sub of subChunks) {
        chunks.push({
          content: sub.content,
          metadata: {
            chunkIndex: chunks.length,
            startChar: charOffset + sub.metadata.startChar,
            endChar: charOffset + sub.metadata.endChar,
          },
        });
      }
    }

    charOffset += segment.length;
  }

  return chunks;
}

// ============================================
// PDF-AWARE CHUNKING
// ============================================

/**
 * PDF-aware chunking that preserves page numbers and entity integrity
 */
export function chunkWithPages(
  text: string,
  pageBreakPattern: RegExp = /\f/g,
  options: SmartChunkOptions = {}
): TextChunk[] {
  const opts = { ...SMART_DEFAULTS, ...options };
  const pages = text.split(pageBreakPattern);
  const allChunks: TextChunk[] = [];

  let globalCharOffset = 0;

  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const pageText = pages[pageNum];

    // Use smart chunking for each page
    const pageChunks = opts.preserveEntities
      ? chunkSmartParagraphs(pageText, opts)
      : chunkByParagraphs(pageText, opts);

    for (const chunk of pageChunks) {
      allChunks.push({
        content: chunk.content,
        metadata: {
          chunkIndex: allChunks.length,
          startChar: globalCharOffset + chunk.metadata.startChar,
          endChar: globalCharOffset + chunk.metadata.endChar,
          pageNumber: pageNum + 1,
          containsEntities: chunk.metadata.containsEntities,
        },
      });
    }

    globalCharOffset += pageText.length + 1; // +1 for page break char
  }

  return allChunks;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Merge small adjacent chunks that together don't exceed max size
 */
export function mergeSmallChunks(
  chunks: TextChunk[],
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const merged: TextChunk[] = [];

  let current: TextChunk | null = null;

  for (const chunk of chunks) {
    if (!current) {
      current = { ...chunk };
      continue;
    }

    const combinedLength = current.content.length + chunk.content.length + 2; // +2 for separator

    if (combinedLength <= opts.maxChunkSize) {
      // Merge chunks
      current.content = `${current.content}\n\n${chunk.content}`;
      current.metadata.endChar = chunk.metadata.endChar;
      if (chunk.metadata.containsEntities) {
        current.metadata.containsEntities = [
          ...(current.metadata.containsEntities || []),
          ...chunk.metadata.containsEntities,
        ];
      }
    } else {
      merged.push(current);
      current = { ...chunk };
    }
  }

  if (current) {
    merged.push(current);
  }

  // Re-index
  return merged.map((chunk, index) => ({
    ...chunk,
    metadata: { ...chunk.metadata, chunkIndex: index },
  }));
}

/**
 * Add overlap between chunks for better context continuity
 */
export function addChunkOverlap(
  chunks: TextChunk[],
  overlapSize: number = 100
): TextChunk[] {
  if (chunks.length <= 1) return chunks;

  return chunks.map((chunk, index) => {
    if (index === 0) return chunk;

    const prevChunk = chunks[index - 1];
    const overlapText = prevChunk.content.slice(-overlapSize);

    // Find a clean break point
    const lastSentence = overlapText.lastIndexOf('. ');
    const cleanOverlap = lastSentence > 0
      ? overlapText.slice(lastSentence + 2)
      : overlapText;

    return {
      ...chunk,
      content: `${cleanOverlap}${chunk.content}`,
    };
  });
}
