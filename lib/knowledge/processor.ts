// lib/knowledge/processor.ts - Document processing pipeline
// Adapted from ai-saas: removed tenantId (single-tenant DDT chatbot)
import { db, knowledgeSources, documentChunks } from '@/db';
import { eq } from 'drizzle-orm';
import { parseDocument, parseURL, detectMimeType } from './parser';
import {
  chunkSmartParagraphs,
  chunkSmartSections,
  chunkByQAPairs,
  detectQAStructure,
  mergeSmallChunks,
  type SmartChunkOptions,
  type TextChunk,
} from './chunker';
import { generateEmbeddings } from './embeddings';

// ============================================
// POISON FILTER — reject placeholder/garbage chunks
// ============================================

const POISON_PATTERNS: RegExp[] = [
  /lorem\s+ipsum/i,
  /\[(?:placeholder|todo|tbd|insert|your .+ here)\]/i,
  /^(?:I don'?t know\.?|N\/A\.?|TBD\.?|TODO\.?|Coming soon\.?|Under construction\.?)$/im,
  /^(?:This is a (?:sample|test|example|placeholder))/im,
];

function isPoisonedChunk(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 5) return true;
  return POISON_PATTERNS.some(pattern => pattern.test(trimmed));
}

function filterPoisonedChunks(chunks: TextChunk[]): { clean: TextChunk[]; poisonedCount: number } {
  const clean: TextChunk[] = [];
  let poisonedCount = 0;

  for (const chunk of chunks) {
    if (isPoisonedChunk(chunk.content)) {
      poisonedCount++;
    } else {
      clean.push({
        ...chunk,
        metadata: { ...chunk.metadata, chunkIndex: clean.length },
      });
    }
  }

  return { clean, poisonedCount };
}

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  preserveEntities?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  chunkCount?: number;
  error?: string;
}

/**
 * Process an uploaded document end-to-end
 */
export async function processDocument(
  knowledgeSourceId: string,
  buffer: Buffer,
  fileName: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const [ks] = await db.select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, knowledgeSourceId));

  if (!ks) {
    return { success: false, error: 'Knowledge source not found' };
  }

  try {
    await db.update(knowledgeSources)
      .set({
        status: 'processing',
        metadata: {
          ...(ks.metadata as object),
          processingStartedAt: new Date().toISOString(),
        },
      })
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    const mimeType = detectMimeType(fileName);
    if (!mimeType) throw new Error(`Unsupported file type: ${fileName}`);

    const parsed = await parseDocument(buffer, mimeType);

    const isQA = ks.type === 'qa' || detectQAStructure(parsed.content);

    const chunkOptions: SmartChunkOptions = {
      maxChunkSize: options.chunkSize || 1000,
      chunkOverlap: options.chunkOverlap || 200,
      minChunkSize: isQA ? 10 : 100,
      preserveEntities: true,
      entityPadding: 50,
    };

    let chunks: TextChunk[];
    let chunkStrategy: string;

    if (isQA) {
      chunks = chunkByQAPairs(parsed.content, chunkOptions);
      chunkStrategy = 'qa_pairs';
    } else if (mimeType === 'text/markdown') {
      chunks = chunkSmartSections(parsed.content, chunkOptions);
      chunks = mergeSmallChunks(chunks, chunkOptions);
      chunkStrategy = 'smart_sections';
    } else {
      chunks = chunkSmartParagraphs(parsed.content, chunkOptions);
      chunks = mergeSmallChunks(chunks, chunkOptions);
      chunkStrategy = 'smart_paragraphs';
    }

    const { clean, poisonedCount } = filterPoisonedChunks(chunks);
    chunks = clean;

    const entityInfo = chunks.filter(c => c.metadata.containsEntities?.length).length;
    console.log(
      `Processing ${ks.type} [${chunkStrategy}]: ` +
      `${parsed.content.length} chars -> ${chunks.length} chunks ` +
      `(${entityInfo} with entities` +
      `${poisonedCount > 0 ? `, ${poisonedCount} poisoned discarded` : ''})`
    );

    const contents = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(contents);

    const chunkRecords = chunks.map((chunk, i) => ({
      id: `chunk_${crypto.randomUUID().slice(0, 12)}`,
      knowledgeSourceId,
      content: chunk.content,
      embedding: `[${embeddings[i].join(',')}]` as any,
      metadata: chunk.metadata as Record<string, unknown>,
    }));

    if (chunkRecords.length > 0) {
      await db.insert(documentChunks).values(chunkRecords as any);
    }

    await db.update(knowledgeSources)
      .set({
        status: 'ready',
        metadata: {
          ...(ks.metadata as object),
          charCount: parsed.metadata.charCount,
          pageCount: parsed.metadata.pageCount,
          chunkCount: chunks.length,
          processingCompletedAt: new Date().toISOString(),
        },
      })
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    return { success: true, chunkCount: chunks.length };

  } catch (error) {
    await db.update(knowledgeSources)
      .set({
        status: 'error',
        metadata: {
          ...(ks.metadata as object),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process a URL source
 */
export async function processURL(
  knowledgeSourceId: string,
  url: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const [ks] = await db.select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, knowledgeSourceId));

  if (!ks) {
    return { success: false, error: 'Knowledge source not found' };
  }

  try {
    await db.update(knowledgeSources)
      .set({
        status: 'processing',
        metadata: {
          ...(ks.metadata as object),
          processingStartedAt: new Date().toISOString(),
        },
      })
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    const parsed = await parseURL(url);

    const isQA = parsed.metadata.hasFAQStructure || detectQAStructure(parsed.content);

    const chunkOptions: SmartChunkOptions = {
      maxChunkSize: options.chunkSize || 1000,
      chunkOverlap: options.chunkOverlap || 200,
      minChunkSize: isQA ? 10 : (options.minChunkSize || 100),
      preserveEntities: true,
      entityPadding: 50,
    };

    let chunks: TextChunk[];
    if (isQA) {
      chunks = chunkByQAPairs(parsed.content, chunkOptions);
    } else {
      chunks = chunkSmartParagraphs(parsed.content, chunkOptions);
      chunks = mergeSmallChunks(chunks, chunkOptions);
    }

    const { clean, poisonedCount } = filterPoisonedChunks(chunks);
    chunks = clean;
    if (poisonedCount > 0) {
      console.log(`URL processing: discarded ${poisonedCount} poisoned chunks from ${url}`);
    }

    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    const chunkRecords = chunks.map((chunk, i) => ({
      id: `chunk_${crypto.randomUUID().slice(0, 12)}`,
      knowledgeSourceId,
      content: chunk.content,
      embedding: `[${embeddings[i].join(',')}]` as any,
      metadata: { ...chunk.metadata, url } as Record<string, unknown>,
    }));

    if (chunkRecords.length > 0) {
      await db.insert(documentChunks).values(chunkRecords as any);
    }

    await db.update(knowledgeSources)
      .set({
        status: 'ready',
        metadata: {
          ...(ks.metadata as object),
          url,
          title: parsed.metadata.title,
          charCount: parsed.metadata.charCount,
          chunkCount: chunks.length,
          processingCompletedAt: new Date().toISOString(),
        },
      })
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    return { success: true, chunkCount: chunks.length };

  } catch (error) {
    await db.update(knowledgeSources)
      .set({
        status: 'error',
        metadata: {
          ...(ks.metadata as object),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Re-process a knowledge source
 */
export async function reprocessKnowledgeSource(
  knowledgeSourceId: string
): Promise<ProcessingResult> {
  await db.delete(documentChunks)
    .where(eq(documentChunks.knowledgeSourceId, knowledgeSourceId));

  const [ks] = await db.select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, knowledgeSourceId));

  if (!ks) return { success: false, error: 'Knowledge source not found' };

  if (ks.type === 'url' && (ks.metadata as any)?.url) {
    return processURL(knowledgeSourceId, (ks.metadata as any).url);
  }

  return { success: false, error: 'Cannot reprocess: original file not stored' };
}

/**
 * Get knowledge source type from filename or URL
 */
export function getKnowledgeSourceType(input: string): string {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return 'url';
  }
  const ext = input.toLowerCase().split('.').pop();
  const typeMap: Record<string, string> = {
    'pdf': 'pdf',
    'txt': 'txt',
    'md': 'md',
    'docx': 'docx',
  };
  return typeMap[ext || ''] || 'txt';
}

/**
 * Validate file for upload
 */
export function validateFile(file: { size: number; name: string }): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 10MB.' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedTypes = ['pdf', 'txt', 'md', 'doc', 'docx'];
  if (!ext || !allowedTypes.includes(ext)) {
    return { valid: false, error: `Unsupported file type. Allowed: ${allowedTypes.join(', ')}` };
  }

  return { valid: true };
}
