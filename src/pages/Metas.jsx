import { useState, useEffect } from "react";
import { fetchGoals, fetchTasks } from "../lib/api";

const TEAM_ID = "90132888652";
const LIST_VIEW_IDS = {
  Comercial: "2ky5df2c-5233",
  Correlaize: "2ky5df2c-5253",
  "Customer Success": "2ky5df2c-5293",
  RH: "2ky5df2c-5313",
  Financeiro: "2ky5df2c-5273",
};

const clamp = (v) => Math.max(0, Math.min(Number(v) || 0, 100));
const circleOffset = (pct) => 238.6 * (1 - clamp(pct) / 100);

function fmtVal(kr) {
  const { current: cur, target: tgt } = kr;
  const brl = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");
  if (kr.type === "currency") return { cur: brl(cur), tgt: brl(tgt) };
  if (kr.type === "automatic") return { cur: `${Math.round(cur)}`, tgt: `${Math.round(tgt)} tasks` };
  const name = kr.name.toLowerCase();
  if (name.includes("score") || name.includes("redução") || name.includes("health"))
    return { cur: `${Math.round(cur)}%`, tgt: `${Math.round(tgt)}%` };
  return { cur: `${Math.round(cur)}`, tgt: `meta ${Math.round(tgt)}` };
}

function typeLabel(type) {
  if (type === "currency") return "💰 Financeiro";
  if (type === "automatic") return "✅ Governança";
  return "📊 Operacional";
}

function SummaryCard({ goal }) {
  return (
    <div className="summary-card" style={{ "--color": goal.color }}>
      <div className="circle-wrap">
        <svg width="76" height="76" viewBox="0 0 76 76">
          <circle className="circle-bg" cx="38" cy="38" r="32" />
          <circle
            className="circle-fill"
            cx="38"
            cy="38"
            r="32"
            style={{ strokeDashoffset: circleOffset(goal.percent) }}
          />
        </svg>
        <div className="circle-text">{Math.round(clamp(goal.percent))}%</div>
      </div>
      <h3>{goal.name}</h3>
      <div className="sub">{goal.keyResults.length} indicadores</div>
    </div>
  );
}

function Sector({ goal, tasks }) {
  const sectorTasks = tasks[goal.name] || [];
  const groups = {};
  goal.keyResults.forEach((kr) => {
    const lbl = typeLabel(kr.type);
    (groups[lbl] ||= []).push(kr);
  });

  return (
    <div className="sector" style={{ "--color": goal.color }}>
      <div className="sector-header">
        <div className="sector-icon" />
        <a className="sector-name" href={goal.goalUrl} target="_blank" rel="noopener noreferrer">
          {goal.name}
        </a>
        <span className="sector-badge">{Math.round(clamp(goal.percent))}% concluído</span>
      </div>
      <div className="sector-divider" />
      <div className="sector-body">
        {Object.entries(groups).map(([label, krs]) => (
          <div className="kr-group" key={label}>
            <div className="kr-type-label">{label}</div>
            {krs.map((kr) => {
              const pct = clamp(kr.percent);
              const { cur, tgt } = fmtVal(kr);
              const isGov = kr.type === "automatic";
              const krHref = isGov
                ? `https://app.clickup.com/${TEAM_ID}/v/l/${LIST_VIEW_IDS[goal.name]}`
                : goal.goalUrl;
              return (
                <div className="kr-item" key={kr.id}>
                  <div className="kr-row">
                    <a className="kr-name" href={krHref} target="_blank" rel="noopener noreferrer">
                      {kr.name}
                    </a>
                    <div className="kr-vals">
                      <span className="kr-cur">{cur}</span>
                      <span className="kr-tgt">/ {tgt}</span>
                    </div>
                  </div>
                  <div className="kr-bar">
                    <div className="kr-fill" style={{ width: `${pct}%`, "--color": goal.color }} />
                  </div>
                  <div className="kr-pct">{Math.round(pct)}%</div>
                  {isGov && sectorTasks.length > 0 && (
                    <div className="tasks-grid">
                      {sectorTasks.map((t, i) => (
                        <div className={`task-pill ${t.closed ? "done" : ""}`} key={i}>
                          <span className="task-icon">{t.closed ? "✓" : "○"}</span>
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Metas() {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [g, t] = await Promise.all([fetchGoals(), fetchTasks()]);
        if (!alive) return;
        setGoals(Array.isArray(g) ? g : []);
        setTasks(t && typeof t === "object" ? t : {});
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

  return (
    <div className="metas-page">
      <style>{METAS_CSS}</style>
      <div className="container">
        <div className="section-label">Visão Geral por Setor</div>
        <div className="summary">
          {loading ? (
            <div className="loading" style={{ gridColumn: "1/-1" }}>
              Carregando metas...
            </div>
          ) : error ? (
            <div className="loading" style={{ gridColumn: "1/-1" }}>
              Erro ao carregar.
            </div>
          ) : (
            goals.map((g) => <SummaryCard key={g.goalId} goal={g} />)
          )}
        </div>
        {!loading && !error && goals.length > 0 && (
          <>
            <div className="section-label">Detalhamento por Setor</div>
            {goals.map((g) => (
              <Sector key={g.goalId} goal={g} tasks={tasks} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const METAS_CSS = `
.metas-page {
  --bg-deep:#050c18; --bg-card:#09152a; --bg-hover:#0e1e3a;
  --border:#152540; --border-lit:#1e3a60;
  --neon:#00b4ff; --neon-dim:rgba(0,180,255,0.06); --neon-glow:rgba(0,180,255,0.12);
  --text-hi:#d6eeff; --text-md:#7aa8cc; --text-lo:#3d6080;
  --done:#00d4a0; --done-dim:rgba(0,212,160,0.10);
  background:var(--bg-deep); color:var(--text-hi);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  min-height:100%;
}
.metas-page * { margin:0; padding:0; box-sizing:border-box; }
.metas-page .container { padding:28px 36px; max-width:1280px; margin:0 auto; }
.metas-page .section-label {
  font-size:10px; text-transform:uppercase; letter-spacing:0.12em;
  color:var(--text-lo); font-weight:600; margin-bottom:14px;
}
.metas-page .summary {
  display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:36px;
}
.metas-page .summary-card {
  background:var(--bg-card); border:1px solid var(--border); border-radius:14px;
  padding:22px 14px 18px; text-align:center; transition:all 0.2s;
  position:relative; overflow:hidden;
}
.metas-page .summary-card::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,var(--color),transparent); opacity:0.7;
}
.metas-page .circle-wrap { position:relative; width:76px; height:76px; margin:0 auto 12px; }
.metas-page .circle-wrap svg { transform:rotate(-90deg); }
.metas-page .circle-bg { fill:none; stroke:var(--border-lit); stroke-width:4; }
.metas-page .circle-fill {
  fill:none; stroke:var(--color); stroke-width:4; stroke-linecap:round;
  stroke-dasharray:238.6;
  filter:drop-shadow(0 0 2px var(--color));
  transition:stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1);
}
.metas-page .circle-text {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  font-size:17px; font-weight:800; color:var(--color);
  text-shadow:0 2px 4px rgba(0,0,0,0.25);
}
.metas-page .summary-card h3 { font-size:12px; font-weight:600; color:var(--text-hi); }
.metas-page .summary-card .sub { font-size:11px; color:var(--text-lo); margin-top:3px; }
.metas-page .sector {
  background:var(--bg-card); border:1px solid var(--border); border-radius:14px;
  margin-bottom:14px; overflow:hidden; transition:border-color 0.2s;
}
.metas-page .sector:hover { border-color:var(--border-lit); }
.metas-page .sector-header {
  display:flex; align-items:center; padding:16px 24px; gap:12px; cursor:pointer;
}
.metas-page .sector-header:hover { background:var(--bg-hover); }
.metas-page .sector-icon {
  width:8px; height:28px; border-radius:4px; background:var(--color);
  box-shadow:0 0 4px var(--color); flex-shrink:0;
}
.metas-page .sector-name {
  font-size:14px; font-weight:700; flex:1; color:inherit; text-decoration:none;
}
.metas-page .sector-name:hover { text-decoration:underline; }
.metas-page .sector-badge {
  font-size:11px; font-weight:700; color:var(--color);
  background:color-mix(in srgb, var(--color) 10%, transparent);
  border:1px solid color-mix(in srgb, var(--color) 25%, transparent);
  padding:4px 12px; border-radius:20px;
}
.metas-page .sector-divider { height:1px; background:var(--border); margin:0; }
.metas-page .sector-body { padding:20px 24px 22px; }
.metas-page .kr-group { margin-bottom:24px; }
.metas-page .kr-group:last-child { margin-bottom:0; }
.metas-page .kr-type-label {
  font-size:10px; text-transform:uppercase; letter-spacing:0.1em;
  color:var(--text-lo); font-weight:600; margin-bottom:12px;
  display:flex; align-items:center; gap:8px;
}
.metas-page .kr-type-label::after { content:''; flex:1; height:1px; background:var(--border); }
.metas-page .kr-item { margin-bottom:16px; }
.metas-page .kr-item:last-child { margin-bottom:0; }
.metas-page .kr-row {
  display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;
}
.metas-page .kr-name {
  font-size:18px; font-weight:500; color:var(--text-hi);
  text-decoration:none; cursor:pointer;
}
.metas-page .kr-name:hover { color:var(--neon); text-decoration:underline; }
.metas-page .kr-vals { display:flex; align-items:baseline; gap:5px; }
.metas-page .kr-cur { font-size:14px; font-weight:800; color:var(--color); text-shadow:0 2px 4px rgba(0,0,0,0.25); }
.metas-page .kr-tgt { font-size:11px; color:var(--text-lo); }
.metas-page .kr-bar {
  height:6px; background:var(--border); border-radius:4px; overflow:hidden; margin-bottom:4px;
}
.metas-page .kr-fill {
  height:100%; border-radius:4px;
  background:linear-gradient(90deg, color-mix(in srgb, var(--color) 60%, #000), var(--color));
  box-shadow:0 0 4px var(--color);
  transition:width 1.4s cubic-bezier(0.4,0,0.2,1);
}
.metas-page .kr-pct { font-size:11px; color:var(--text-lo); text-align:right; }
.metas-page .tasks-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:14px; }
.metas-page .task-pill {
  display:flex; align-items:flex-start; gap:8px; padding:9px 12px;
  background:var(--bg-deep); border:1px solid var(--border); border-radius:8px;
  font-size:12px; color:var(--text-md); line-height:1.3; transition:border-color 0.15s;
}
.metas-page .task-pill.done {
  color:var(--done); border-color:color-mix(in srgb, var(--done) 30%, transparent);
  background:var(--done-dim);
}
.metas-page .task-icon { font-size:12px; flex-shrink:0; margin-top:1px; }
.metas-page .loading { text-align:center; padding:60px; color:var(--text-lo); font-size:13px; }
@media (max-width:900px) {
  .metas-page .summary { grid-template-columns:repeat(2,1fr); }
  .metas-page .tasks-grid { grid-template-columns:1fr; }
  .metas-page .container { padding:16px; }
}
`;
