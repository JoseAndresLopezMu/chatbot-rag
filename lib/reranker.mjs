import "./transformersConfig.mjs";
import { AutoTokenizer, AutoModelForSequenceClassification } from "@huggingface/transformers";

// ms-marco-MiniLM-L-6-v2: pequeno (~23MB cuantizado), cabe de sobra en el
// limite de 100MB por fichero de Vercel. Entrenado en ingles -- ver el
// comentario de lib/embeddings.mjs sobre el tradeoff multilingue.
const MODEL_ID = "Xenova/ms-marco-MiniLM-L-6-v2";

let modelPromise;
let tokenizerPromise;

async function getModelAndTokenizer() {
  if (!modelPromise) {
    modelPromise = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, { dtype: "q8" });
    tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_ID);
  }
  return Promise.all([modelPromise, tokenizerPromise]);
}

/**
 * Reordena `candidates` (array de {content, ...}) por relevancia real a `query`
 * usando un cross-encoder (query, documento) -> puntuacion de relevancia.
 * Devuelve los candidatos con un campo `rerank_score` anadido, ordenados desc.
 */
export async function rerank(query, candidates) {
  if (candidates.length === 0) return [];
  const [model, tokenizer] = await getModelAndTokenizer();

  const scored = [];
  for (const candidate of candidates) {
    const inputs = await tokenizer(query, {
      text_pair: candidate.content,
      truncation: true,
      max_length: 512,
      padding: true,
    });
    const output = await model(inputs);
    const score = output.logits.data[0];
    scored.push({ ...candidate, rerank_score: score });
  }

  scored.sort((a, b) => b.rerank_score - a.rerank_score);
  return scored;
}
