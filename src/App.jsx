import { useState, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function Message({ role, content, route, sources }) {
  return (
    <div className={`message message--${role}`}>
      <div className="message__bubble">
        {route === "calculo" && <span className="badge">🧮 Cálculo</span>}
        {route === "rag" && <span className="badge">📚 RAG</span>}
        <p>{content}</p>
        {sources && sources.length > 0 && (
          <details className="sources">
            <summary>📎 Ver fuentes consultadas ({sources.length})</summary>
            <ul>
              {sources.map((s, i) => (
                <li key={i}>
                  <b>{s.fileName}</b> — página {s.pageNumber}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [sessionDoc, setSessionDoc] = useState(null); // { fileName, chunks }
  const fileInputRef = useRef(null);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          history,
          sessionChunks: sessionDoc ? sessionDoc.chunks : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, route: data.route, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/process-document`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSessionDoc({ fileName: data.fileName, chunks: data.chunks });
      setMessages([]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearSessionDoc() {
    setSessionDoc(null);
    setMessages([]);
    setUploadError(null);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>📄 Asistente Inteligente de Documentos</h1>
        <p>RAG con recuperación híbrida (BM25 + semántica + RRF + cross-encoder + MMR)</p>
      </header>

      <div className="app__upload">
        {sessionDoc ? (
          <>
            <span className="upload-status">
              📄 Usando solo: <b>{sessionDoc.fileName}</b> ({sessionDoc.chunks.length} fragmentos)
            </span>
            <button type="button" className="upload-btn" onClick={clearSessionDoc}>
              ✕ Volver al corpus por defecto
            </button>
          </>
        ) : (
          <>
            <label className="upload-btn">
              {uploading ? "Procesando…" : "📤 Subir documento (PDF/DOCX/TXT/MD)"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.md,.txt"
                onChange={handleUpload}
                disabled={uploading}
                hidden
              />
            </label>
            <span className="upload-status">usando el corpus de licitación por defecto</span>
          </>
        )}
        {uploadError && <span className="upload-status">❌ {uploadError}</span>}
      </div>

      <div className="app__messages">
        {messages.length === 0 && (
          <p className="empty-hint">
            {sessionDoc
              ? `Pregunta algo sobre "${sessionDoc.fileName}".`
              : "Pregunta algo sobre el pliego de licitación y las ofertas, o pide un cálculo matemático."}
          </p>
        )}
        {messages.map((m, i) => (
          <Message key={i} {...m} />
        ))}
        {loading && <div className="message message--assistant"><div className="message__bubble">Pensando…</div></div>}
      </div>

      <form className="app__input" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Haz una pregunta sobre los documentos o pide un cálculo..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>Enviar</button>
      </form>
    </div>
  );
}
