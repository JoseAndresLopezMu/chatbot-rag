import { parseMultipartFile } from "../lib/parseMultipart.mjs";
import { convertToMarkdown } from "../lib/convertDoc.mjs";
import { chunkText } from "../lib/chunker.mjs";
import { embedBatch } from "../lib/embeddings.mjs";
import { query } from "../lib/db.mjs";
import { applyCors } from "../lib/cors.mjs";

export const config = { api: { bodyParser: false } };

/**
 * Sube un documento (PDF/DOCX/TXT/MD), lo convierte, trocea, calcula
 * embeddings y lo guarda en Supabase para que quede disponible en el RAG.
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

    const docResult = await query(
      "insert into documents (file_name, source_type, markdown) values ($1, $2, $3) returning id",
      [fileName, sourceType, markdown]
    );
    const documentId = docResult.rows[0].id;

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

    const vectors = await embedBatch(allChunks.map((c) => c.content));
    for (let i = 0; i < allChunks.length; i++) {
      const vectorLiteral = `[${vectors[i].join(",")}]`;
      await query(
        `insert into chunks (document_id, chunk_index, page_number, content, embedding)
         values ($1, $2, $3, $4, $5)`,
        [documentId, i, allChunks[i].page, allChunks[i].content, vectorLiteral]
      );
    }

    res.status(200).json({ documentId, fileName, chunkCount: allChunks.length });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}
