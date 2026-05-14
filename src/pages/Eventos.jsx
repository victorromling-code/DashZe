import { useState, useEffect } from "react";
import { fetchEventos } from "../lib/api";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const STATUS_STYLE = {
  "captação ativada": "background:rgba(34,197,94,.15);color:#22c55e",
  "em planejamento": "background:rgba(245,158,11,.15);color:#f59e0b",
  "confirmado. a planejar": "background:rgba(59,130,246,.15);color:#60aaff",
  "não confirmado": "background:rgba(107,114,128,.15);color:#9ca3af",
  finalizado: "background:rgba(107,114,128,.15);color:#9ca3af",
};

const BOX_COLOR = {
  "captação ativada": "#22c55e",
  "em planejamento": "#f59e0b",
  "confirmado. a planejar": "#0070e0",
  "não confirmado": "#1c2d42",
  finalizado: "#1c2d42",
};

function styleObj(str) {
  return Object.fromEntries(
    str.split(";").filter(Boolean).map((d) => {
      const [k, v] = d.split(":");
      return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()];
    })
  );
}

function daysUntil(ts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((ts - today.getTime()) / 86400000);
}

function countdownLabel(days) {
  if (days < 0) return "Encerrado";
  if (days === 0) return "Hoje";
  if (days === 1) return "Falta 1 dia";
  return `Faltam ${days} dias`;
}

function groupByMonth(data) {
  const byMonth = {};
  data.forEach((e) => {
    const m = new Date(e.dateTs).getMonth();
    (byMonth[m] ||= []).push(e);
  });
  const months = Object.keys(byMonth)
    .map(Number)
    .sort((a, b) => Math.min(...byMonth[a].map((e) => e.dateTs)) - Math.min(...byMonth[b].map((e) => e.dateTs)));
  return months.map((m) => ({
    month: m,
    events: byMonth[m].sort((a, b) => a.dateTs - b.dateTs),
  }));
}

export default function Eventos() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const d = await fetchEventos();
        if (!alive) return;
        setData(Array.isArray(d) ? d : []);
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

  const blocks = groupByMonth(data);

  return (
    <div className="eventos-page">
      <style>{EVENTOS_CSS}</style>
      {loading ? (
        <p className="ev-msg">Carregando eventos...</p>
      ) : error ? (
        <p className="ev-msg">Erro ao carregar eventos.</p>
      ) : blocks.length === 0 ? (
        <p className="ev-msg">Nenhum evento cadastrado.</p>
      ) : (
        blocks.map(({ month, events }) => (
          <div className="month-block" key={month}>
            <div className="card">
              <span className="card-tag">Eventos — {MONTH_NAMES[month]}</span>
              <div className="ev-list">
                {events.map((e) => {
                  const st = (e.status || "").toLowerCase();
                  const stStyle = styleObj(STATUS_STYLE[st] || "background:rgba(107,114,128,.15);color:#9ca3af");
                  const boxBg = BOX_COLOR[st] || "#1c2d42";
                  const days = daysUntil(e.dateTs);
                  return (
                    <div className="ev-row" key={e.id}>
                      <div className="ev-box" style={{ background: boxBg }}>
                        <div className="d">{e.day}</div>
                        <div className="m">{e.monthAbrev}</div>
                      </div>
                      <div className="ev-info">
                        <div className="ev-title">{e.name}</div>
                        <div className="ev-meta">
                          {e.status && (
                            <span className="ev-status" style={stStyle}>
                              {e.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="ev-countdown">{countdownLabel(days)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const EVENTOS_CSS = `
.eventos-page {
  --navy:#080d1a; --navy-card:#131e30; --navy-edge:#1c2d42;
  --blue:#0070e0; --white:#f0f4ff; --muted:#7a90aa; --border:#1c2d42;
  background:var(--navy); color:var(--white);
  font-family:'Segoe UI',sans-serif; min-height:100%; padding:24px;
}
.eventos-page * { margin:0; padding:0; box-sizing:border-box; }
.eventos-page .month-block { margin-bottom:20px; }
.eventos-page .card {
  background:var(--navy-card); border:1px solid var(--border);
  border-radius:8px; padding:16px; max-width:560px;
}
.eventos-page .card-tag {
  display:inline-block; font-size:9px; font-weight:700;
  text-transform:uppercase; letter-spacing:0.6px;
  border-radius:3px; padding:2px 8px;
  background:rgba(0,112,224,.18); color:#60aaff; margin-bottom:14px;
}
.eventos-page .ev-list { display:flex; flex-direction:column; gap:14px; }
.eventos-page .ev-row { display:flex; gap:12px; align-items:flex-start; position:relative; }
.eventos-page .ev-box {
  border-radius:6px; text-align:center; padding:5px 10px; min-width:42px; flex-shrink:0;
}
.eventos-page .ev-box .d { font-size:17px; font-weight:800; line-height:1; }
.eventos-page .ev-box .m { font-size:9px; text-transform:uppercase; letter-spacing:0.4px; margin-top:2px; }
.eventos-page .ev-info { flex:1; padding-right:40px; }
.eventos-page .ev-title { font-size:13px; font-weight:600; line-height:1.4; margin-bottom:4px; }
.eventos-page .ev-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.eventos-page .ev-status {
  font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;
  padding:2px 7px; border-radius:3px;
}
.eventos-page .ev-countdown {
  position:absolute; bottom:0; right:0; font-size:10px; color:var(--muted);
}
.eventos-page .ev-msg { color:var(--muted); font-size:13px; }
@media (max-width:480px) {
  .eventos-page { padding:14px; }
  .eventos-page .card { max-width:100%; }
}
`;
