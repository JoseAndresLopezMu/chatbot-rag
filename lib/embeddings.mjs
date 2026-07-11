import "./transformersConfig.mjs";
import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let embedderPromise;

function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", MODEL_ID, { dtype: "fp32" });
  }
  return embedderPromise;
}

/** Devuelve un array de numeros (embedding denso, 384 dims) para un texto. */
export async function embedText(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/** Embeddings para varios textos a la vez (mas eficiente que uno a uno). */
export async function embedBatch(texts) {
  const embedder = await getEmbedder();
  const output = await embedder(texts, { pooling: "mean", normalize: true });
  const dims = output.dims[1];
  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(output.data.slice(i * dims, (i + 1) * dims)));
  }
  return vectors;
}
