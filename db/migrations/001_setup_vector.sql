-- Enable pgvector for embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable trigram for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- HNSW index for fast cosine similarity search on embeddings
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
ON document_chunks
USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Replace the text search_vector column with a GENERATED tsvector column
-- (Must run AFTER drizzle push creates the table with search_vector as text)
ALTER TABLE document_chunks DROP COLUMN IF EXISTS search_vector;
ALTER TABLE document_chunks
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector
ON document_chunks USING GIN (search_vector);

-- GIN trigram index for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_chunks_content_trgm
ON document_chunks USING GIN (content gin_trgm_ops);
