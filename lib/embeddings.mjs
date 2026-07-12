import "./transformersConfig.mjs";
import { pipeline } from "@huggingface/transformers";

// all-MiniLM-L6-v2: pequeno (~90MB fp32 / ~23MB cuantizado), cabe de sobra en
// el limite de 100MB por fichero de Vercel y descarga rapido en frio.
// Entrenado sobre todo en ingles -- ver README para el tradeoff de precision
// en espanol frente a alternativas multilingues (bge-m3, e5-small), que
// pesan demasiado para desplegarse aqui sin infraestructura adicional
// (API de embeddings externa en vez de pesos locales).
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let embedderPromise;

function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
  }
  return embedderPromise;
}

/** Embedding denso (384 dims) para una pregunta de busqueda. */
export async function embedQuery(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/** Embeddings (384 dims) para varios fragmentos de documento a indexar. */
export async function embedPassages(texts) {
  const embedder = await getEmbedder();
  const output = await embedder(texts, { pooling: "mean", normalize: true });
  const dims = output.dims[1];
  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(output.data.slice(i * dims, (i + 1) * dims)));
  }
  return vectors;
}
