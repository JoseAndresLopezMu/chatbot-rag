import { parseMultipartFile } from "../lib/parseMultipart.mjs";
import { convertToMarkdown } from "../lib/convertDoc.mjs";
import { applyCors } from "../lib/cors.mjs";

export const config = { api: { bodyParser: false } };

/**
 * Microservicio de conversion DOCX/PDF -> Markdown, expuesto como endpoint
 * RESTful independiente (no requiere pasar por la ingesta ni Supabase).
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }
  try {
    const { fileName, buffer } = await parseMultipartFile(req);
    const { markdown, pages, sourceType } = await convertToMarkdown(buffer, fileName);
    res.status(200).json({ fileName, sourceType, markdown, pageCount: pages.length });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}
