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
  const [uploadStatus, setUploadStatus] = useState(null);
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
        body: JSON.stringify({ input: text, history }),
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
    setUploadStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/ingest`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUploadStatus(`✅ "${data.fileName}" indexado (${data.chunkCount} fragmentos).`);
    } catch (err) {
      setUploadStatus(`❌ ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>📄 Asistente Inteligente de Documentos</h1>
        <p>RAG con recuperación híbrida (BM25 + semántica + RRF + cross-encoder + MMR)</p>
      </header>

      <div className="app__upload">
        <label className="upload-btn">
          {uploading ? "Subiendo…" : "📤 Subir documento (PDF/DOCX/TXT/MD)"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.md,.txt"
            onChange={handleUpload}
            disabled={uploading}
            hidden
          />
        </label>
        {uploadStatus && <span className="upload-status">{uploadStatus}</span>}
      </div>

      <div className="app__messages">
        {messages.length === 0 && (
          <p className="empty-hint">
            Pregunta algo sobre los documentos indexados, o pide un cálculo matemático.
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
