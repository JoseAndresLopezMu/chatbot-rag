create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  source_type text not null,
  markdown text not null,
  created_at timestamptz not null default now()
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  page_number int,
  content text not null,
  embedding vector(384),
  content_tsv tsvector generated always as (to_tsvector('spanish', content)) stored,
  created_at timestamptz not null default now()
);

create index if not exists chunks_embedding_hnsw_idx
  on chunks using hnsw (embedding vector_cosine_ops);

create index if not exists chunks_content_tsv_idx
  on chunks using gin (content_tsv);

-- Busqueda hibrida: BM25-like (ts_rank sobre tsvector) + semantica (coseno sobre pgvector),
-- fusionadas con Reciprocal Rank Fusion (RRF). Devuelve tambien file_name (para citar la
-- fuente) y el embedding de cada chunk (para poder aplicar MMR despues en la aplicacion).
create or replace function hybrid_search(
  query_text text,
  query_embedding vector(384),
  match_count int default 20,
  rrf_k int default 50
)
returns table (
  chunk_id uuid,
  document_id uuid,
  file_name text,
  content text,
  page_number int,
  embedding vector(384),
  rrf_score double precision
)
language sql
as $$
  with lexical as (
    select id, document_id, content, page_number,
           row_number() over (order by ts_rank(content_tsv, plainto_tsquery('spanish', query_text)) desc) as rank
    from chunks
    where content_tsv @@ plainto_tsquery('spanish', query_text)
    limit match_count * 4
  ),
  semantic as (
    select id, document_id, content, page_number,
           row_number() over (order by chunks.embedding <=> query_embedding) as rank
    from chunks
    order by chunks.embedding <=> query_embedding
    limit match_count * 4
  ),
  fused as (
    select id, document_id, content, page_number,
           sum(1.0 / (rrf_k + rank)) as rrf_score
    from (
      select * from lexical
      union all
      select * from semantic
    ) combined
    group by id, document_id, content, page_number
  )
  select f.id as chunk_id, f.document_id, d.file_name, f.content, f.page_number,
         c.embedding, f.rrf_score
  from fused f
  join documents d on d.id = f.document_id
  join chunks c on c.id = f.id
  order by f.rrf_score desc
  limit match_count;
$$;
