import { useState, useEffect } from "react";
import { fetchAvisos } from "../lib/api";

const STATUS_COLOR = {
  ativo: "#22c55e",
  expirado: "#6b7280",
};

export default function Mural() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await fetchAvisos();
        if (!alive) return;
        setAvisos(Array.isArray(data) ? data : []);
        setError(false);
      } catch (e) {
        console.error(e);
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mural-page">
      <style>{MURAL_CSS}</style>
      <div className="grid">
        {loading ? (
          <div className="loading">Carregando avisos...</div>
        ) : error ? (
          <div className="empty">Erro ao carregar avisos.</div>
        ) : avisos.length === 0 ? (
          <div className="empty">Nenhum aviso encontrado.</div>
        ) : (
          avisos.map((a) => {
            const st = (a.status || "").toLowerCase();
            const color = STATUS_COLOR[st] || "#0070e0";
            return (
              <div className="card" style={{ "--c": color }} key={a.id}>
                <div className="card-badge">{a.status || "—"}</div>
                <div className="card-title">{a.title}</div>
                {a.description && <div className="card-body">{a.description}</div>}
                <div className="card-footer">
                  <span>{a.setor || "—"}</span>
                  <span>{a.date || "—"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const MURAL_CSS = `
.mural-page {
  --navy:#080d1a; --navy-card:#131e30; --blue:#0070e0; --blue-light:#1a8fff;
  --white:#f0f4ff; --muted:#7a90aa; --border:#1c2d42;
  background:var(--navy); color:var(--white);
  font-family:'Segoe UI',sans-serif; min-height:100%;
}
.mural-page * { margin:0; padding:0; box-sizing:border-box; }
.mural-page .grid {
  display:grid; grid-template-columns:repeat(3,1fr); gap:16px; padding:24px 28px 40px;
}
.mural-page .card {
  background:var(--navy-card); border:1px solid var(--border);
  border-left:3px solid var(--c, var(--blue)); border-radius:8px;
  padding:16px; display:flex; flex-direction:column; gap:10px;
  transition:box-shadow .15s, border-color .15s;
}
.mural-page .card-badge {
  display:inline-block; font-size:9px; font-weight:700;
  text-transform:uppercase; letter-spacing:0.6px;
  border-radius:3px; padding:2px 8px;
  background:color-mix(in srgb, var(--c, var(--blue)) 15%, transparent);
  color:var(--c, var(--blue-light)); width:fit-content;
}
.mural-page .card-title { font-size:13px; font-weight:700; line-height:1.4; }
.mural-page .card-body { font-size:12px; color:var(--muted); line-height:1.6; flex:1; }
.mural-page .card-footer {
  display:flex; align-items:center; justify-content:space-between;
  font-size:10px; color:var(--muted);
  border-top:1px solid var(--border); padding-top:10px; margin-top:auto;
}
.mural-page .loading,
.mural-page .empty {
  text-align:center; padding:60px; color:var(--muted); font-size:13px; grid-column:1/-1;
}
@media (max-width:900px) { .mural-page .grid { grid-template-columns:1fr 1fr; padding:16px; } }
@media (max-width:580px) { .mural-page .grid { grid-template-columns:1fr; } }
`;
