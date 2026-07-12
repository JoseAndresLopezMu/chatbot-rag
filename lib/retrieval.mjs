import { query } from "./db.mjs";
import { embedQuery } from "./embeddings.mjs";
import { rerank } from "./reranker.mjs";
import { mmrSelect } from "./mmr.mjs";

/**
 * Pipeline de recuperacion hibrida completo:
 * 1) BM25 (tsvector) + semantica (pgvector), fusionadas con RRF (en SQL).
 * 2) Cross-encoder reranking sobre los candidatos fusionados.
 * 3) MMR para diversificar el top final antes de pasarselo al LLM.
 */
export async function retrieve(userQuery, { candidatePoolSize = 20, finalK = 5, mmrLambda = 0.7 } = {}) {
  const queryEmbedding = await embedQuery(userQuery);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const { rows: candidates } = await query(
    "select * from hybrid_search($1, $2, $3)",
    [userQuery, vectorLiteral, candidatePoolSize]
  );

  if (candidates.length === 0) return [];

  const normalized = candidates.map((c) => ({
    chunkId: c.chunk_id,
    documentId: c.document_id,
    fileName: c.file_name,
    content: c.content,
    pageNumber: c.page_number,
    embedding: parsePgVector(c.embedding),
    rrfScore: c.rrf_score,
  }));

  const reranked = await rerank(userQuery, normalized);
  const withRelevance = reranked.map((c) => ({ ...c, relevance: c.rerank_score }));

  return mmrSelect(withRelevance, { k: finalK, lambda: mmrLambda });
}

/**
 * Recuperacion sobre un documento de sesion (no persistido en Supabase):
 * ranking denso simple (coseno contra el embedding de la pregunta) seguido
 * del mismo cross-encoder + MMR que el pipeline por defecto. No hace falta
 * BM25/RRF aqui: el conjunto de chunks es pequeno (un documento subido).
 */
export async function retrieveFromChunks(userQuery, sessionChunks, { finalK = 5, mmrLambda = 0.7 } = {}) {
  if (!sessionChunks || sessionChunks.length === 0) return [];

  const queryEmbedding = await embedQuery(userQuery);

  const withCosine = sessionChunks.map((c) => ({
    chunkId: c.chunkIndex,
    documentId: "session",
    fileName: c.fileName,
    content: c.content,
    pageNumber: c.pageNumber,
    embedding: c.embedding,
    rrfScore: cosineSim(queryEmbedding, c.embedding),
  }));

  const candidatePool = withCosine
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, 20);

  const reranked = await rerank(userQuery, candidatePool);
  const withRelevance = reranked.map((c) => ({ ...c, relevance: c.rerank_score }));

  return mmrSelect(withRelevance, { k: finalK, lambda: mmrLambda });
}

function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

function parsePgVector(pgVectorValue) {
  if (Array.isArray(pgVectorValue)) return pgVectorValue;
  // pg devuelve pgvector como string "[0.1,0.2,...]"
  return JSON.parse(pgVectorValue);
}
