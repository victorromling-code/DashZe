import { useState, useEffect } from "react";
import { fetchAniversariantes } from "../lib/api";

const AVATAR_COLORS = ["#0a3560", "#0070e0", "#1c2d42", "#065f46", "#7c3aed", "#b45309", "#9f1239", "#0e7490", "#854d0e"];
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const initials = (name) => name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const shortName = (name) => name.trim().split(" ").slice(0, 2).join(" ");

function avatarColor(name) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function daysUntil(month, day) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), month, day);
  if (next < today) next = new Date(now.getFullYear() + 1, month, day);
  return Math.round((next - today) / 86400000);
}

function groupByMonth(data) {
  const byMonth = {};
  data.forEach((p) => {
    if (p.month === null || p.month === undefined) return;
    (byMonth[p.month] ||= []).push(p);
  });
  const months = Object.keys(byMonth)
    .map(Number)
    .sort((a, b) => {
      const minA = Math.min(...byMonth[a].map((p) => daysUntil(p.month, p.day)));
      const minB = Math.min(...byMonth[b].map((p) => daysUntil(p.month, p.day)));
      return minA - minB;
    });
  return months.map((m) => ({
    month: m,
    people: byMonth[m].sort((a, b) => daysUntil(a.month, a.day) - daysUntil(b.month, b.day)),
  }));
}

export default function Aniversariantes() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const d = await fetchAniversariantes();
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
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const blocks = groupByMonth(data);

  return (
    <div className="aniv-page">
      <style>{ANIV_CSS}</style>
      {loading ? (
        <p className="aniv-msg">Carregando...</p>
      ) : error ? (
        <p className="aniv-msg">Erro ao carregar.</p>
      ) : blocks.length === 0 ? (
        <p className="aniv-msg">Nenhum aniversariante cadastrado.</p>
      ) : (
        blocks.map(({ month, people }) => (
          <div className="month-block" key={month}>
            <div className="card">
              <span className="card-tag">Aniversários — {MONTH_NAMES[month]}</span>
              <div className="aniv-list">
                {people.map((p, i) => (
                  <div className="aniv-row" key={i}>
                    <div className="avatar" style={{ background: avatarColor(p.name) }}>
                      {initials(p.name)}
                    </div>
                    <div>
                      <div className="aniv-name">{shortName(p.name)}</div>
                      <div className="aniv-date">
                        {p.dateStr}
                        {p.cargo ? " · " + p.cargo : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const ANIV_CSS = `
.aniv-page {
  --navy:#080d1a; --navy-card:#131e30; --navy-edge:#1c2d42;
  --blue:#0070e0; --blue-light:#1a8fff; --white:#f0f4ff;
  --muted:#7a90aa; --border:#1c2d42; --purple:#a78bfa;
  background:var(--navy); color:var(--white);
  font-family:'Segoe UI',sans-serif; min-height:100%; padding:24px;
}
.aniv-page * { margin:0; padding:0; box-sizing:border-box; }
.aniv-page .month-block { margin-bottom:20px; }
.aniv-page .card {
  background:var(--navy-card); border:1px solid var(--border);
  border-radius:8px; padding:16px; max-width:420px;
}
.aniv-page .card-tag {
  display:inline-block; font-size:9px; font-weight:700;
  text-transform:uppercase; letter-spacing:0.6px;
  border-radius:3px; padding:2px 8px;
  background:rgba(167,139,250,.15); color:var(--purple); margin-bottom:14px;
}
.aniv-page .aniv-list { display:flex; flex-direction:column; gap:12px; }
.aniv-page .aniv-row { display:flex; align-items:center; gap:10px; }
.aniv-page .avatar {
  width:34px; height:34px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-weight:700; font-size:11px; flex-shrink:0;
  border:1px solid var(--navy-edge); color:#fff;
}
.aniv-page .aniv-name { font-size:13px; font-weight:600; }
.aniv-page .aniv-date { font-size:11px; color:var(--muted); margin-top:1px; }
.aniv-page .aniv-msg { color:var(--muted); font-size:13px; }
@media (max-width:480px) {
  .aniv-page { padding:14px; }
  .aniv-page .card { max-width:100%; }
}
`;
