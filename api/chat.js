import { runChat } from "../lib/agent.mjs";
import { applyCors } from "../lib/cors.mjs";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }
  try {
    const { input, history, sessionChunks } = req.body;
    if (!input || typeof input !== "string") {
      res.status(400).json({ error: "Falta el campo 'input' (string)" });
      return;
    }
    const result = await runChat({
      input,
      history: Array.isArray(history) ? history : [],
      sessionChunks: Array.isArray(sessionChunks) ? sessionChunks : [],
    });
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
