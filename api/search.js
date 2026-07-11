import { retrieve } from "../lib/retrieval.mjs";
import { applyCors } from "../lib/cors.mjs";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }
  try {
    const { query, k } = req.body;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Falta el campo 'query' (string)" });
      return;
    }
    const results = await retrieve(query, { finalK: k || 5 });
    res.status(200).json({
      results: results.map((r) => ({
        content: r.content,
        fileName: r.fileName,
        pageNumber: r.pageNumber,
        rerankScore: r.rerank_score,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
