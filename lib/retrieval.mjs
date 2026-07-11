import { query } from "./db.mjs";
import { embedText } from "./embeddings.mjs";
import { rerank } from "./reranker.mjs";
import { mmrSelect } from "./mmr.mjs";

/**
 * Pipeline de recuperacion hibrida completo:
 * 1) BM25 (tsvector) + semantica (pgvector), fusionadas con RRF (en SQL).
 * 2) Cross-encoder reranking sobre los candidatos fusionados.
 * 3) MMR para diversificar el top final antes de pasarselo al LLM.
 */
export async function retrieve(userQuery, { candidatePoolSize = 20, finalK = 5, mmrLambda = 0.7 } = {}) {
  const queryEmbedding = await embedText(userQuery);
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

function parsePgVector(pgVectorValue) {
  if (Array.isArray(pgVectorValue)) return pgVectorValue;
  // pg devuelve pgvector como string "[0.1,0.2,...]"
  return JSON.parse(pgVectorValue);
}
