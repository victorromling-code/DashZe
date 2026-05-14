import { useState, useEffect, useCallback, useMemo } from "react";
import { subMonths, startOfMonth, endOfMonth, format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchKommo, fetchClickup } from "../lib/api";

const PIPELINE_CONFIG = {
  receptivo: {
    ids: [12732823],
    label: "Receptivo",
    pipeName: "Pipeline Principal",
    agendamento: [100698244, 100698464],
    callRealizada: [104919748, 104919752, 104919572],
    venda: [142],
    followup: [104919740, 143],
  },
  prospectivo: {
    ids: [13367464],
    label: "Prospectivo",
    pipeName: "Social Selling",
    agendamento: [104319860, 104319864],
    callRealizada: [104319856, 104319860, 104319864],
    venda: [142],
    followup: [103102988, 143],
    vendaLabel: "Agendamento gerado",
  },
};

const CONSULTORES = [
  { id: 14620227, name: "Beatriz Bilha", role: "Closer", setor: "Closer" },
  { id: 14620215, name: "Regina Filha", role: "Closer", setor: "Closer" },
  { id: 14908500, name: "Caio Dias", role: "Closer", setor: "Closer" },
  { id: 14750880, name: "Lucas Medeiros", role: "SDR", setor: "SDR" },
  { id: 15149160, name: "Fernanda Alves", role: "Social Seller", setor: "Social Seller" },
  { id: 15128548, name: "Renata", role: "Social Seller", setor: "Social Seller" },
];

const METAS = { agendamento: 0.25, call: 0.66, venda: 0.20 };
const CLICKUP_COMERCIAL_SPACE = "901312576743";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const COLORS = {
  bg: "#F5F8FA", card: "#FFFFFF", border: "#CBD6E2",
  textPrimary: "#33475B", textSecondary: "#516F90", textTertiary: "#7C98B6",
  accent: "#0091AE", receptivo: "#00BDA5", receptivoLight: "#D6F4EE",
  prospectivo: "#2D3E50", prospectivoLight: "#DDE3EB",
  ok: "#00A4BD", okLight: "#D6F4F9", warn: "#FFB400", warnLight: "#FFF3D6",
  bad: "#F2545B", badLight: "#FDE5E7", neutral: "#7C98B6", neutralLight: "#EAF0F6",
  gold: "#FFB400", silver: "#B0B9C2", bronze: "#CD7F32",
  closer: "#00BDA5", sdr: "#FFB400", socialSeller: "#7B68EE",
  success: "#00A656", successLight: "#DAF3E5",
};

// ----- CACHE EM MEMÓRIA -----
const cache = new Map();
const cacheKey = (pids, from, to) => `${pids.join(",")}_${from}_${to}`;

async function fetchLeadsCached(pipelineIds, dateFrom, dateTo) {
  const key = cacheKey(pipelineIds, dateFrom, dateTo);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const all = [];
  for (const pid of pipelineIds) {
    let page = 1;
    while (true) {
     const url = `leads?filter[pipeline_id][]=${pid}&filter[updated_at][from]=${dateFrom}&filter[updated_at][to]=${dateTo}&limit=250&page=${page}`;
      const data = await fetchKommo(url);
      const leads = data?._embedded?.leads || [];
      all.push(...leads);
      if (leads.length < 250) break;
      page++;
    }
  }
  cache.set(key, { data: all, ts: Date.now() });
  return all;
}

async function fetchClickupTasksCached() {
  const key = "clickup_tasks";
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  try {
    const listsRes = await fetchClickup(`space/${CLICKUP_COMERCIAL_SPACE}/list?archived=false`);
    const lists = listsRes?.lists || [];
    let total = 0, pending = 0, done = 0;
    for (const list of lists) {
      const tasksRes = await fetchClickup(`list/${list.id}/task?archived=false&include_closed=true`);
      const tasks = tasksRes?.tasks || [];
      total += tasks.length;
      pending += tasks.filter(t => t.status?.type !== "closed").length;
      done += tasks.filter(t => t.status?.type === "closed").length;
    }
    const result = { total, pending, done };
    cache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch { return { total: 0, pending: 0, done: 0 }; }
}

function clearCache() { cache.clear(); }

function calcFunil(leads, config) {
  const total = leads.length;
  const agend = leads.filter(l =>
    config.agendamento.includes(l.status_id) ||
    config.callRealizada.includes(l.status_id) ||
    config.venda.includes(l.status_id)
  ).length;
  const callReal = leads.filter(l =>
    config.callRealizada.includes(l.status_id) ||
    config.venda.includes(l.status_id)
  ).length;
  const venda = leads.filter(l => config.venda.includes(l.status_id)).length;
  const followup = leads.filter(l => config.followup.includes(l.status_id)).length;
  return { total, agend, callReal, venda, followup };
}

const ALL_AGEND = [
  ...PIPELINE_CONFIG.receptivo.agendamento, ...PIPELINE_CONFIG.receptivo.callRealizada, ...PIPELINE_CONFIG.receptivo.venda,
  ...PIPELINE_CONFIG.prospectivo.agendamento, ...PIPELINE_CONFIG.prospectivo.callRealizada, ...PIPELINE_CONFIG.prospectivo.venda,
];
const ALL_CALL = [
  ...PIPELINE_CONFIG.receptivo.callRealizada, ...PIPELINE_CONFIG.receptivo.venda,
  ...PIPELINE_CONFIG.prospectivo.callRealizada, ...PIPELINE_CONFIG.prospectivo.venda,
];
const ALL_VENDA = [142];
const ALL_FOLLOW = [...PIPELINE_CONFIG.receptivo.followup, ...PIPELINE_CONFIG.prospectivo.followup];

function calcRanking(allLeads) {
  const map = {};
  CONSULTORES.forEach(c => { map[c.id] = { ...c, leads: 0, agend: 0, callReal: 0, vendas: 0, followup: 0 }; });
  for (const lead of allLeads) {
    const uid = lead.responsible_user_id;
    if (!map[uid]) continue;
    map[uid].leads++;
    if (ALL_AGEND.includes(lead.status_id)) map[uid].agend++;
    if (ALL_CALL.includes(lead.status_id)) map[uid].callReal++;
    if (ALL_VENDA.includes(lead.status_id)) map[uid].vendas++;
    if (ALL_FOLLOW.includes(lead.status_id)) map[uid].followup++;
  }
  return Object.values(map);
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const safeNum = (n) => (Number.isFinite(n) ? n : 0);

function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 6, padding: "16px 20px", border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${accent || COLORS.accent}` }}>
      <div style={{ fontSize: 11, color: COLORS.textTertiary, marginBottom: 8, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function FunnelStage({ stage, count, prevStageCount, prevStageName, meta, prevPeriodCount, neutral }) {
  const realPct = prevStageCount > 0 ? Math.round((count / prevStageCount) * 100) : 0;
  const metaPct = meta ? Math.round(meta * 100) : null;
  const metaAbsoluta = meta ? Math.round(prevStageCount * meta) : null;
  const ok = meta && count >= metaAbsoluta;
  const warn = meta && count >= metaAbsoluta * 0.75;
  const color = neutral ? COLORS.neutral : (ok ? COLORS.success : warn ? COLORS.warn : COLORS.bad);
  const fillBar = meta ? Math.min(100, Math.round((count / metaAbsoluta) * 100)) : 100;
  const diff = prevPeriodCount !== undefined ? count - prevPeriodCount : null;

  // Mensagem de meta
  let metaMsg = null;
  let metaMsgColor = COLORS.textTertiary;
  if (meta) {
    if (count >= metaAbsoluta) {
      const superou = count - metaAbsoluta;
      metaMsg = superou > 0 ? `✓ superou em ${superou}` : "✓ na meta";
      metaMsgColor = COLORS.success;
    } else {
      const faltam = metaAbsoluta - count;
      metaMsg = `faltam ${faltam} pra meta`;
      metaMsgColor = COLORS.bad;
    }
  }

  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: 600, marginBottom: 6 }}>{stage}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1 }}>{count}</span>
            {meta && (
              <span style={{ fontSize: 12, color: COLORS.textTertiary, fontWeight: 500 }}>
                / meta <span style={{ fontWeight: 700, color: COLORS.textSecondary }}>{metaAbsoluta}</span>
              </span>
            )}
            {metaMsg && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: ok ? COLORS.successLight : COLORS.badLight,
                color: metaMsgColor,
              }}>{metaMsg}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 4 }}>
            {meta ? (
              <>de {prevStageCount} {prevStageName.toLowerCase()} → <span style={{ fontWeight: 600 }}>{realPct}%</span> {metaPct && <span>(meta {metaPct}%)</span>}</>
            ) : (
              <span>retornarão pra retrabalho futuro</span>
            )}
          </div>
        </div>
        {diff !== null && diff !== 0 && (
          <div style={{ fontSize: 11, color: diff >= 0 ? COLORS.success : COLORS.bad, fontWeight: 700, paddingBottom: 4 }}>
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)} vs ant.
          </div>
        )}
      </div>
      <div style={{ height: 6, background: "#EAF0F6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${fillBar}%`, height: "100%", background: color, transition: "width 0.6s ease", borderRadius: 99 }} />
      </div>
    </div>
  );
}

function FunnelCard({ tipo, data, prev, loading }) {
  const cfg = PIPELINE_CONFIG[tipo];
  const color = tipo === "receptivo" ? COLORS.receptivo : COLORS.prospectivo;
  const bgLight = tipo === "receptivo" ? COLORS.receptivoLight : COLORS.prospectivoLight;
  if (loading || !data) return <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, padding: 24, minHeight: 360 }}><div style={{ color: COLORS.textTertiary, fontSize: 13 }}>Carregando...</div></div>;
  const fechLabel = tipo === "prospectivo" ? "Agendamento gerado" : "Fechamento";

  return (
    <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", background: bgLight, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Funil {tipo === "receptivo" ? "Inbound" : "Outbound"}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary, marginTop: 2 }}>{cfg.label}</div>
          <div style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 2 }}>{cfg.pipeName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{data.total}</div>
          <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
            leads {prev && (data.total - prev.total !== 0) && (
              <span style={{ color: data.total >= prev.total ? COLORS.success : COLORS.bad, fontWeight: 600 }}>
                {data.total >= prev.total ? "+" : ""}{data.total - prev.total}
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: "0 20px" }}>
        <FunnelStage stage="Agendamentos" count={data.agend} prevStageCount={data.total} prevStageName="Leads" meta={METAS.agendamento} prevPeriodCount={prev?.agend} />
        <FunnelStage stage="Calls realizadas" count={data.callReal} prevStageCount={data.agend} prevStageName="Agendamentos" meta={METAS.call} prevPeriodCount={prev?.callReal} />
        <FunnelStage stage={fechLabel} count={data.venda} prevStageCount={data.callReal} prevStageName="Calls" meta={METAS.venda} prevPeriodCount={prev?.venda} />
        <FunnelStage stage="Follow-up" count={data.followup} prevStageCount={data.total} prevStageName="" prevPeriodCount={prev?.followup} neutral={true} />
      </div>
    </div>
  );
}

function VolumeStrip({ recData, proData, loading }) {
  if (loading || !recData || !proData) return null;
  const stages = [
    { label: "Leads", rec: recData.total, pro: proData.total, color: COLORS.accent },
    { label: "Agendamentos", rec: recData.agend, pro: proData.agend, color: COLORS.warn },
    { label: "Calls realizadas", rec: recData.callReal, pro: proData.callReal, color: COLORS.receptivo },
    { label: "Fechamento / Ag. gerado", rec: recData.venda, pro: proData.venda, color: COLORS.ok },
    { label: "Follow-up", rec: recData.followup, pro: proData.followup, color: COLORS.neutral },
  ];
  return (
    <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>Volume por etapa</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {stages.map(s => (
          <div key={s.label} style={{ borderLeft: `3px solid ${s.color}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1 }}>{safeNum(s.rec) + safeNum(s.pro)}</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>
              <span style={{ color: COLORS.receptivo, fontWeight: 600 }}>{safeNum(s.rec)}</span> rec · <span style={{ color: COLORS.prospectivo, fontWeight: 600 }}>{safeNum(s.pro)}</span> pro
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Podium({ ranking, metric, title, subtitle, color, onConsultantClick }) {
  const sorted = [...ranking].sort((a, b) => b[metric] - a[metric]);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const maxVal = Math.max(...sorted.map(r => r[metric]), 1);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = { 0: 80, 1: 110, 2: 60 };
  const medals = { 0: { color: COLORS.silver, label: "2º" }, 1: { color: COLORS.gold, label: "1º" }, 2: { color: COLORS.bronze, label: "3º" } };
  return (
    <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, background: "#FAFCFD" }}>
        <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{subtitle}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary, marginTop: 2 }}>{title}</div>
      </div>
      <div style={{ padding: "24px 20px 16px", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 12, minHeight: 180 }}>
        {podiumOrder.map((p, idx) => {
          const medal = medals[idx];
          return (
            <div key={p.id} onClick={() => onConsultantClick(p)} style={{ flex: 1, maxWidth: 110, textAlign: "center", cursor: "pointer" }}>
              <div style={{ width: 38, height: 38, margin: "0 auto 6px", borderRadius: "50%", background: medal.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>{medal.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name.split(" ")[0]}</div>
              <div style={{ fontSize: 10, color: COLORS.textTertiary, marginBottom: 6 }}>{p.role}</div>
              <div style={{ height: heights[idx], background: `linear-gradient(180deg, ${medal.color} 0%, ${medal.color}AA 100%)`, borderRadius: "4px 4px 0 0", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 8, color: "#fff", fontWeight: 700, fontSize: 20 }}>{p[metric]}</div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "8px 20px" }}>
          {rest.map((r, i) => {
            const barW = Math.round((r[metric] / maxVal) * 100);
            return (
              <div key={r.id} onClick={() => onConsultantClick(r)} style={{ padding: "8px 0", display: "flex", alignItems: "center", gap: 12, borderBottom: i < rest.length - 1 ? `1px solid #EAF0F6` : "none", cursor: "pointer" }}>
                <span style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, minWidth: 22 }}>{i + 4}º</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: COLORS.textPrimary, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>{r[metric]}</span>
                  </div>
                  <div style={{ height: 4, background: "#EAF0F6", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${barW}%`, height: "100%", background: color }} />
                  </div>
                </div>
                <span style={{ fontSize: 10, color: COLORS.textTertiary, minWidth: 80, textAlign: "right" }}>{r.role}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectorRanking({ ranking, setor, metric, title, color, onConsultantClick }) {
  const filtered = ranking.filter(r => r.setor === setor);
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) => b[metric] - a[metric]);
  const max = Math.max(...sorted.map(r => r[metric]), 1);
  return (
    <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, padding: "16px 20px", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{setor}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginTop: 2 }}>{title}</div>
        </div>
        <span style={{ fontSize: 22, fontWeight: 700, color }}>{filtered.reduce((s, r) => s + r[metric], 0)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((r, idx) => {
          const w = Math.round((r[metric] / max) * 100);
          const medalLabel = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`;
          return (
            <div key={r.id} onClick={() => onConsultantClick(r)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "2px 0" }}>
              <span style={{ fontSize: 12, minWidth: 22 }}>{medalLabel}</span>
              <span style={{ fontSize: 12, color: COLORS.textPrimary, fontWeight: 600, minWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name.split(" ")[0]}</span>
              <div style={{ flex: 1, height: 14, background: "#EAF0F6", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${w}%`, height: "100%", background: color, transition: "width 0.6s ease" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary, minWidth: 28, textAlign: "right" }}>{r[metric]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClickUpCard({ data, loading }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>ClickUp · Espaço Comercial</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Tarefas totais", val: data?.total, color: COLORS.accent },
          { label: "Pendentes", val: data?.pending, color: COLORS.warn },
          { label: "Concluídas", val: data?.done, color: COLORS.ok },
        ].map(m => (
          <div key={m.label} style={{ borderLeft: `2px solid ${m.color}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 500 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.textPrimary, marginTop: 2 }}>{loading ? "..." : (m.val ?? 0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.3 }}>{label.toUpperCase()}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        fontSize: 13, padding: "6px 28px 6px 10px", borderRadius: 3,
        border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.textPrimary, fontWeight: 500, cursor: "pointer",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path fill='%237C98B6' d='M6 8L2 4h8z'/></svg>")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
      }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.3 }}>{label.toUpperCase()}</span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{
        fontSize: 13, padding: "6px 10px", borderRadius: 3, border: `1px solid ${COLORS.border}`,
        background: COLORS.card, color: COLORS.textPrimary, fontWeight: 500, cursor: "pointer",
      }}/>
    </div>
  );
}

function ConsultantDrawer({ consultant, allLeads, onClose, periodFrom, periodTo }) {
  if (!consultant) return null;
  const userLeads = allLeads.filter(l => l.responsible_user_id === consultant.id);
  const isSocialSeller = consultant.setor === "Social Seller";

  const stats = useMemo(() => {
    const total = userLeads.length;
    const agend = userLeads.filter(l => ALL_AGEND.includes(l.status_id)).length;
    const callReal = userLeads.filter(l => ALL_CALL.includes(l.status_id)).length;
    const venda = userLeads.filter(l => ALL_VENDA.includes(l.status_id)).length;
    const followup = userLeads.filter(l => ALL_FOLLOW.includes(l.status_id)).length;
    return { total, agend, callReal, venda, followup };
  }, [userLeads]);

  const evolution = useMemo(() => {
    if (userLeads.length === 0) return [];
    const days = differenceInDays(periodTo, periodFrom);
    const grouping = days > 60 ? "month" : days > 14 ? "week" : "day";
    const buckets = {};
    for (const lead of userLeads) {
      const d = new Date(lead.created_at * 1000);
      let key;
      if (grouping === "day") key = format(d, "dd/MM");
      else if (grouping === "week") key = `Sem ${format(d, "w")}`;
      else key = format(d, "MMM/yy", { locale: ptBR });
      if (!buckets[key]) buckets[key] = { leads: 0, vendas: 0, agend: 0 };
      buckets[key].leads++;
      if (ALL_AGEND.includes(lead.status_id)) buckets[key].agend++;
      if (ALL_VENDA.includes(lead.status_id)) buckets[key].vendas++;
    }
    return Object.entries(buckets).map(([k, v]) => ({ label: k, ...v }));
  }, [userLeads, periodFrom, periodTo]);

  const maxEvo = Math.max(...evolution.map(e => Math.max(e.leads, e.agend, e.vendas)), 1);
  const recentLeads = [...userLeads].sort((a, b) => b.updated_at - a.updated_at).slice(0, 8);

  const statusName = (statusId) => {
    if (ALL_VENDA.includes(statusId)) return { label: "Fechado", color: COLORS.ok };
    if (ALL_CALL.includes(statusId)) return { label: "Call/Negociação", color: COLORS.warn };
    if (ALL_AGEND.includes(statusId)) return { label: "Agendado", color: COLORS.receptivo };
    if (ALL_FOLLOW.includes(statusId)) return { label: "Follow-up", color: COLORS.neutral };
    return { label: "Em aberto", color: COLORS.textTertiary };
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45, 62, 80, 0.4)", zIndex: 100, animation: "fadeIn 0.2s" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, height: "100vh", width: "min(560px, 90vw)",
        background: COLORS.bg, zIndex: 101, boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
        overflowY: "auto", animation: "slideIn 0.25s ease",
      }}>
        <style>{`
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        <div style={{ background: COLORS.card, padding: "20px 24px", borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: consultant.setor === "Closer" ? COLORS.closer : consultant.setor === "SDR" ? COLORS.sdr : COLORS.socialSeller,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 18,
              }}>{consultant.name.charAt(0)}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary }}>{consultant.name}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{consultant.role} · {consultant.setor}</div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", fontSize: 22, cursor: "pointer",
              color: COLORS.textTertiary, padding: 0, width: 32, height: 32,
            }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {[
              { label: "Leads", val: stats.total, color: COLORS.accent },
              { label: "Agend.", val: stats.agend, color: COLORS.warn },
              { label: "Calls", val: stats.callReal, color: COLORS.receptivo },
              { label: isSocialSeller ? "Ag. ger." : "Fech.", val: stats.venda, color: COLORS.ok },
            ].map(m => (
              <div key={m.label} style={{ background: COLORS.card, padding: "10px 12px", borderRadius: 4, border: `1px solid ${COLORS.border}`, borderTop: `2px solid ${m.color}` }}>
                <div style={{ fontSize: 10, color: COLORS.textTertiary, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, marginTop: 2 }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>Funil pessoal</div>
            <FunnelStage stage="Agendamentos" count={stats.agend} prevStageCount={stats.total} prevStageName="Leads" meta={METAS.agendamento} />
            <FunnelStage stage="Calls realizadas" count={stats.callReal} prevStageCount={stats.agend} prevStageName="Agendamentos" meta={METAS.call} />
            <FunnelStage stage={isSocialSeller ? "Agendamento gerado" : "Fechamento"} count={stats.venda} prevStageCount={stats.callReal} prevStageName="Calls" meta={METAS.venda} />
            <FunnelStage stage="Follow-up" count={stats.followup} prevStageCount={stats.total} prevStageName="" neutral={true} />
          </div>

          <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>Evolução no período</div>
            {evolution.length === 0 ? (
              <div style={{ fontSize: 12, color: COLORS.textTertiary, padding: 12, textAlign: "center" }}>Sem dados no período</div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, paddingBottom: 28, position: "relative", borderBottom: `1px solid ${COLORS.border}` }}>
                {evolution.map((e, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 2, position: "relative" }} title={`${e.label}: ${e.leads} leads · ${e.agend} agend · ${e.vendas} vendas`}>
                    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: "100%" }}>
                      <div style={{ width: 5, height: `${(e.leads / maxEvo) * 100}%`, background: COLORS.accent, borderRadius: "2px 2px 0 0" }} />
                      <div style={{ width: 5, height: `${(e.agend / maxEvo) * 100}%`, background: COLORS.warn, borderRadius: "2px 2px 0 0" }} />
                      <div style={{ width: 5, height: `${(e.vendas / maxEvo) * 100}%`, background: COLORS.ok, borderRadius: "2px 2px 0 0" }} />
                    </div>
                    <div style={{ position: "absolute", bottom: -24, fontSize: 9, color: COLORS.textTertiary, transform: "rotate(-30deg)", transformOrigin: "left center", whiteSpace: "nowrap" }}>{e.label}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11, color: COLORS.textSecondary }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, background: COLORS.accent, marginRight: 4 }} />Leads</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, background: COLORS.warn, marginRight: 4 }} />Agendamentos</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, background: COLORS.ok, marginRight: 4 }} />{isSocialSeller ? "Ag. gerados" : "Vendas"}</span>
            </div>
          </div>

          <div style={{ background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.border}`, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>Leads recentes</div>
            {recentLeads.length === 0 ? (
              <div style={{ fontSize: 12, color: COLORS.textTertiary, padding: 12, textAlign: "center" }}>Sem leads no período</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recentLeads.map((l, i) => {
                  const st = statusName(l.status_id);
                  return (
                    <div key={l.id} style={{ padding: "10px 0", borderBottom: i < recentLeads.length - 1 ? `1px solid ${COLORS.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: COLORS.textPrimary, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                        <div style={{ fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>
                          {format(new Date(l.updated_at * 1000), "dd MMM yy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 3,
                        background: st.color + "22", color: st.color, whiteSpace: "nowrap",
                      }}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function FunilVendas() {
  const today = new Date();
  const [period, setPeriod] = useState("mes_atual");
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(today, "yyyy-MM-dd"));
  const [grupo, setGrupo] = useState("all");
  const [consultant, setConsultant] = useState("all");
  const [loading, setLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState("");
  const [recData, setRecData] = useState(null);
  const [proData, setProData] = useState(null);
  const [recPrev, setRecPrev] = useState(null);
  const [proPrev, setProPrev] = useState(null);
  const [clickup, setClickup] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [allLeadsRaw, setAllLeadsRaw] = useState([]);
  const [selectedConsultant, setSelectedConsultant] = useState(null);

  function getRange(p, prev = false) {
    const hoje = new Date();
    if (p === "personalizado") {
      const cFrom = new Date(customFrom + "T00:00:00");
      const cTo = new Date(customTo + "T23:59:59");
      if (prev) {
        const diff = cTo.getTime() - cFrom.getTime();
        return { from: new Date(cFrom.getTime() - diff), to: new Date(cFrom.getTime() - 1) };
      }
      return { from: cFrom, to: cTo };
    }
    const map = {
      mes_atual: prev
        ? { from: startOfMonth(subMonths(hoje, 1)), to: endOfMonth(subMonths(hoje, 1)) }
        : { from: startOfMonth(hoje), to: hoje },
      mes_anterior: prev
        ? { from: startOfMonth(subMonths(hoje, 2)), to: endOfMonth(subMonths(hoje, 2)) }
        : { from: startOfMonth(subMonths(hoje, 1)), to: endOfMonth(subMonths(hoje, 1)) },
      trimestre: prev
        ? { from: startOfMonth(subMonths(hoje, 5)), to: endOfMonth(subMonths(hoje, 3)) }
        : { from: startOfMonth(subMonths(hoje, 2)), to: hoje },
      semana: prev
        ? { from: new Date(hoje.getTime() - 14 * 86400000), to: new Date(hoje.getTime() - 7 * 86400000) }
        : { from: new Date(hoje.getTime() - 7 * 86400000), to: hoje },
    };
    return map[p];
  }

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) clearCache();
    setLoading(true);
    const startTime = Date.now();
    try {
      const { from, to } = getRange(period);
      const { from: pFrom, to: pTo } = getRange(period, true);
      const fromTs = Math.floor(from.getTime() / 1000);
      const toTs = Math.floor(to.getTime() / 1000);
      const pFromTs = Math.floor(pFrom.getTime() / 1000);
      const pToTs = Math.floor(pTo.getTime() / 1000);

      const [recLeads, proLeads, recPrevLeads, proPrevLeads, cuTasks] = await Promise.all([
        fetchLeadsCached(PIPELINE_CONFIG.receptivo.ids, fromTs, toTs),
        fetchLeadsCached(PIPELINE_CONFIG.prospectivo.ids, fromTs, toTs),
        fetchLeadsCached(PIPELINE_CONFIG.receptivo.ids, pFromTs, pToTs),
        fetchLeadsCached(PIPELINE_CONFIG.prospectivo.ids, pFromTs, pToTs),
        fetchClickupTasksCached(),
      ]);
      const allLeads = [...recLeads, ...proLeads];

      const applyFilter = (leads) => {
        let f = leads;
        if (grupo !== "all") {
          const ids = CONSULTORES.filter(c => c.setor === grupo).map(c => c.id);
          f = f.filter(l => ids.includes(l.responsible_user_id));
        }
        if (consultant !== "all") f = f.filter(l => l.responsible_user_id === parseInt(consultant));
        return f;
      };

      setRecData(calcFunil(applyFilter(recLeads), PIPELINE_CONFIG.receptivo));
      setProData(calcFunil(applyFilter(proLeads), PIPELINE_CONFIG.prospectivo));
      setRecPrev(calcFunil(applyFilter(recPrevLeads), PIPELINE_CONFIG.receptivo));
      setProPrev(calcFunil(applyFilter(proPrevLeads), PIPELINE_CONFIG.prospectivo));
      setRanking(calcRanking(applyFilter(allLeads)));
      setAllLeadsRaw(allLeads);
      setClickup(cuTasks);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setCacheStatus(elapsed < 1 ? `⚡ ${elapsed}s (cache)` : `${elapsed}s`);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [period, grupo, consultant, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const { from, to } = getRange(period);
  const totalLeads = (recData?.total || 0) + (proData?.total || 0);
  const totalAgend = (recData?.agend || 0) + (proData?.agend || 0);
  const totalCall = (recData?.callReal || 0) + (proData?.callReal || 0);
  const totalVendas = (recData?.venda || 0) + (proData?.venda || 0);
  const prevVendas = (recPrev?.venda || 0) + (proPrev?.venda || 0);
  const periodLabel = { mes_atual: "Mês atual", mes_anterior: "Mês anterior", trimestre: "Últimos 3 meses", semana: "Últimos 7 dias", personalizado: "Personalizado" };
  const filteredConsultores = grupo === "all" ? CONSULTORES : CONSULTORES.filter(c => c.setor === grupo);

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", color: COLORS.textPrimary }}>
      <div style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, padding: "16px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>All Business · Zé André</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "2px 0 0" }}>Funil Vendas</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {cacheStatus && <span style={{ fontSize: 11, color: COLORS.textTertiary }}>{cacheStatus}</span>}
            <button onClick={() => load(true)} disabled={loading} style={{
              fontSize: 13, padding: "8px 16px", borderRadius: 3, border: `1px solid ${COLORS.accent}`,
              background: loading ? "#EAF0F6" : COLORS.accent, color: loading ? COLORS.textTertiary : "#fff",
              cursor: loading ? "default" : "pointer", fontWeight: 600,
            }}>{loading ? "Atualizando..." : "↻ Atualizar"}</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "12px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Filtros</div>
          <Filter label="Período" value={period} onChange={setPeriod} options={[
            { v: "semana", l: "Últimos 7 dias" },
            { v: "mes_atual", l: "Mês atual" },
            { v: "mes_anterior", l: "Mês anterior" },
            { v: "trimestre", l: "Últimos 3 meses" },
            { v: "personalizado", l: "📅 Personalizado" },
          ]} />
          {period === "personalizado" && (
            <>
              <DateInput label="De" value={customFrom} onChange={setCustomFrom} />
              <DateInput label="Até" value={customTo} onChange={setCustomTo} />
            </>
          )}
          <Filter label="Setor" value={grupo} onChange={v => { setGrupo(v); setConsultant("all"); }} options={[
            { v: "all", l: "Todos" }, { v: "Closer", l: "Closer" }, { v: "SDR", l: "SDR" }, { v: "Social Seller", l: "Social Seller" },
          ]} />
          <Filter label="Consultor" value={consultant} onChange={setConsultant} options={[
            { v: "all", l: "Todos" }, ...filteredConsultores.map(c => ({ v: c.id.toString(), l: `${c.name} (${c.role})` })),
          ]} />
          <div style={{ marginLeft: "auto", fontSize: 12, color: COLORS.textSecondary }}>
            {format(from, "dd/MM/yy", { locale: ptBR })} — {format(to, "dd/MM/yy", { locale: ptBR })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <MetricCard label="Leads" value={loading ? "..." : totalLeads} sub={`${recData?.total || 0} inbound · ${proData?.total || 0} outbound`} accent={COLORS.accent} />
          <MetricCard label="Agendamentos" value={loading ? "..." : totalAgend} sub={`${pct(totalAgend, totalLeads)}% conv.`} accent={COLORS.warn} />
          <MetricCard label="Calls realizadas" value={loading ? "..." : totalCall} sub={`${pct(totalCall, totalAgend)}% conv.`} accent={COLORS.receptivo} />
          <MetricCard label="Fechamentos" value={loading ? "..." : totalVendas} sub={`${totalVendas - prevVendas >= 0 ? "+" : ""}${totalVendas - prevVendas} vs anterior`} accent={COLORS.ok} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <VolumeStrip recData={recData} proData={proData} loading={loading} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <FunnelCard tipo="receptivo" data={recData} prev={recPrev} loading={loading} />
          <FunnelCard tipo="prospectivo" data={proData} prev={proPrev} loading={loading} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, paddingLeft: 4 }}>🏆 Ranking por setor <span style={{ fontSize: 11, color: COLORS.textTertiary, fontWeight: 500 }}>(clique no consultor pra ver detalhe)</span></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <SectorRanking ranking={ranking} setor="Closer" metric="vendas" title="Fechamentos" color={COLORS.closer} onConsultantClick={setSelectedConsultant} />
          <SectorRanking ranking={ranking} setor="SDR" metric="agend" title="Agendamentos" color={COLORS.sdr} onConsultantClick={setSelectedConsultant} />
          <SectorRanking ranking={ranking} setor="Social Seller" metric="vendas" title="Ag. gerados" color={COLORS.socialSeller} onConsultantClick={setSelectedConsultant} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12, paddingLeft: 4 }}>🥇 Ranking geral</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <Podium ranking={ranking} metric="vendas" title="Ranking de Fechamentos" subtitle="🏆 Top performers" color={COLORS.ok} onConsultantClick={setSelectedConsultant} />
          <Podium ranking={ranking} metric="agend" title="Ranking de Agendamentos" subtitle="🎯 Mais agendamentos" color={COLORS.warn} onConsultantClick={setSelectedConsultant} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <ClickUpCard data={clickup} loading={loading} />
        </div>

        <div style={{ fontSize: 11, color: COLORS.textTertiary, textAlign: "center", paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
          Dados em tempo real Kommo · {periodLabel[period]} · Receptivo: Pipeline Principal · Prospectivo: Social Selling · Cache 5min
        </div>
      </div>

      <ConsultantDrawer
        consultant={selectedConsultant}
        allLeads={allLeadsRaw}
        onClose={() => setSelectedConsultant(null)}
        periodFrom={from}
        periodTo={to}
      />
    </div>
  );
}