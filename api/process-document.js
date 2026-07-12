import { parseMultipartFile } from "../lib/parseMultipart.mjs";
import { convertToMarkdown } from "../lib/convertDoc.mjs";
import { chunkText } from "../lib/chunker.mjs";
import { embedPassages } from "../lib/embeddings.mjs";
import { applyCors } from "../lib/cors.mjs";

export const config = { api: { bodyParser: false } };

/**
 * Procesa un documento subido (PDF/DOCX/TXT/MD) para uso EXCLUSIVO de la
 * sesion actual: lo convierte, trocea y calcula embeddings, y devuelve los
 * chunks al cliente. No se persiste nada en Supabase -- mientras haya un
 * documento de sesion activo, el chat responde solo con el, no con el
 * corpus por defecto.
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

    const allChunks = [];
    for (const page of pages) {
      for (const piece of chunkText(page.text)) {
        allChunks.push({ content: piece, page: page.page });
      }
    }

    if (allChunks.length === 0) {
      res.status(400).json({ error: "No se pudo extraer texto util del documento" });
      return;
    }

    const vectors = await embedPassages(allChunks.map((c) => c.content));
    const chunks = allChunks.map((c, i) => ({
      chunkIndex: i,
      fileName,
      pageNumber: c.page,
      content: c.content,
      embedding: vectors[i],
    }));

    res.status(200).json({ fileName, sourceType, chunks });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}
