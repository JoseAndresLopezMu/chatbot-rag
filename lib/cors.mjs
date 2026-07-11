/**
 * Aplica cabeceras CORS y gestiona el preflight OPTIONS. El frontend se sirve
 * desde un origen distinto (Hugging Face) al backend (Vercel), asi que hace
 * falta habilitar CORS explicitamente. Devuelve `true` si la petición era un
 * preflight ya respondido (el caller debe devolver sin hacer nada mas).
 */
export function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
