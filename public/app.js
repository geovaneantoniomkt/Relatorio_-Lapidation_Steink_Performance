/* Dashboard Lapidation Clinic — lógica de apresentação (sem dependências externas).
   Lê /config.json, /data/meta.json e /data/organic.json (protegidos por senha no servidor). */
"use strict";

/* ===================================================================== utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "href" || k === "src") { if (/^https?:\/\//i.test(String(v))) el.setAttribute(k, v); }
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "hidden") el.hidden = !!v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
function svg(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  return el;
}

const nfBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nfInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nfDec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfDec1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ok = (n) => n != null && Number.isFinite(n);
const fmt = {
  brl: (n) => (ok(n) ? nfBRL.format(n) : "—"),
  int: (n) => (ok(n) ? nfInt.format(n) : "—"),
  dec: (n) => (ok(n) ? nfDec.format(n) : "—"),
  dec1: (n) => (ok(n) ? nfDec1.format(n) : "—"),
  pct: (n) => (ok(n) ? nfDec.format(n) + "%" : "—"),
  compact: (n) => (!ok(n) ? "—" : Math.abs(n) >= 1e6 ? nfDec1.format(n / 1e6) + " mi" : Math.abs(n) >= 1e4 ? nfDec1.format(n / 1e3) + " mil" : nfInt.format(n)),
  date: (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—"),
  dm: (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : ""),
  dateTime: (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  },
};
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function isoToDate(s) { return new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))); }
function dateToIso(d) { return d.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = isoToDate(iso); d.setUTCDate(d.getUTCDate() + n); return dateToIso(d); }
function daysBetween(a, b) { return Math.round((isoToDate(b) - isoToDate(a)) / 86400000) + 1; }
function monthStart(iso) { return iso.slice(0, 8) + "01"; }
function monthEnd(iso) { const d = isoToDate(monthStart(iso)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return dateToIso(d); }
function daysInMonth(iso) { return +monthEnd(iso).slice(8, 10); }
function sum(arr, f) { let s = 0; for (const x of arr) s += f ? (f(x) || 0) : (x || 0); return s; }
const div = (a, b) => (b > 0 ? a / b : null);

function deltaBadge(cur, prev, { goodWhenUp = true, kind = "num" } = {}) {
  if (!ok(cur) || !ok(prev) || prev === 0) return h("span", { class: "delta", text: "—" });
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return h("span", { class: "delta", text: "= igual" });
  const up = pct > 0;
  const good = goodWhenUp ? up : !up;
  const arrow = up ? "↑" : "↓";
  return h("span", { class: `delta ${good ? "up" : "down"}`, title: `Período anterior: ${kind === "brl" ? fmt.brl(prev) : kind === "pct" ? fmt.pct(prev) : fmt.int(prev)}` }, `${arrow} ${nfDec1.format(Math.abs(pct))}%`);
}
function badge(level, text) {
  const cls = level === "ok" ? "ok" : level === "warn" ? "warn" : level === "crit" ? "crit" : "neutral";
  const ico = level === "ok" ? "●" : level === "warn" ? "▲" : level === "crit" ? "■" : "○";
  return h("span", { class: `badge ${cls}` }, `${ico} ${text}`);
}
function statusBadge(effective, configured) {
  const s = effective || configured || "";
  if (s === "ACTIVE") return h("span", { class: "badge status-active", text: "ativo" });
  if (["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "AD_PAUSED"].includes(s)) return h("span", { class: "badge status-paused", text: "pausado" });
  if (s === "ARCHIVED") return h("span", { class: "badge status-paused", text: "arquivado" });
  if (["WITH_ISSUES", "DISAPPROVED", "PENDING_REVIEW", "PENDING_BILLING_INFO", "IN_PROCESS"].includes(s)) return h("span", { class: "badge status-issue", text: s === "PENDING_REVIEW" ? "em análise" : s === "IN_PROCESS" ? "processando" : s === "DISAPPROVED" ? "reprovado" : "com problema" });
  return h("span", { class: "badge status-paused", text: s.toLowerCase() || "—" });
}

/* ============================================================ domínio Meta */
const OBJECTIVE_LABEL = {
  OUTCOME_LEADS: "Cadastros / conversas", OUTCOME_SALES: "Vendas", OUTCOME_TRAFFIC: "Tráfego", OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_ENGAGEMENT: "Engajamento", OUTCOME_APP_PROMOTION: "App", MESSAGES: "Mensagens", LEAD_GENERATION: "Cadastros",
  CONVERSIONS: "Conversões", LINK_CLICKS: "Tráfego", REACH: "Alcance", BRAND_AWARENESS: "Reconhecimento", POST_ENGAGEMENT: "Engajamento",
  VIDEO_VIEWS: "Vídeo", PAGE_LIKES: "Curtidas",
};
const GOAL_RESULT = {
  CONVERSATIONS: { label: "Conversas iniciadas", unit: "conversa", keys: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"], target: "cost_per_conversation", kind: "lead" },
  LEAD_GENERATION: { label: "Cadastros", unit: "cadastro", keys: ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"], target: "cost_per_conversation", kind: "lead" },
  QUALITY_LEAD: { label: "Cadastros", unit: "cadastro", keys: ["lead", "onsite_conversion.lead_grouped"], target: "cost_per_conversation", kind: "lead" },
  QUALITY_CALL: { label: "Ligações", unit: "ligação", keys: ["onsite_conversion.click_to_call", "call_confirm_grouped"], target: "cost_per_conversation", kind: "lead" },
  OFFSITE_CONVERSIONS: { label: "Conversões", unit: "conversão", keys: ["purchase", "offsite_conversion.fb_pixel_purchase", "lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.messaging_conversation_started_7d", "offsite_conversion.fb_pixel_custom"], target: "cost_per_conversation", kind: "lead" },
  VALUE: { label: "Conversões", unit: "conversão", keys: ["purchase", "offsite_conversion.fb_pixel_purchase", "lead"], target: "cost_per_conversation", kind: "lead" },
  LINK_CLICKS: { label: "Cliques no link", unit: "clique", keys: ["link_click"], kind: "traffic" },
  LANDING_PAGE_VIEWS: { label: "Visualizações da página", unit: "visualização", keys: ["landing_page_view", "link_click"], kind: "traffic" },
  PROFILE_VISIT: { label: "Visitas ao perfil", unit: "visita", keys: ["profile_visit", "link_click"], target: "cost_per_profile_visit", kind: "traffic" },
  VISIT_INSTAGRAM_PROFILE: { label: "Visitas ao perfil", unit: "visita", keys: ["profile_visit", "link_click"], target: "cost_per_profile_visit", kind: "traffic" },
  REACH: { label: "Alcance", unit: "pessoa", metric: "reach", kind: "awareness", per: 1000 },
  AD_RECALL_LIFT: { label: "Alcance", unit: "pessoa", metric: "reach", kind: "awareness", per: 1000 },
  IMPRESSIONS: { label: "Impressões", unit: "impressão", metric: "impressions", kind: "awareness", per: 1000 },
  THRUPLAY: { label: "ThruPlays", unit: "thruplay", metric: "thruplays", kind: "awareness" },
  TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: { label: "Visualizações de vídeo", unit: "visualização", keys: ["video_view"], kind: "awareness" },
  POST_ENGAGEMENT: { label: "Engajamentos", unit: "engajamento", keys: ["post_engagement"], kind: "awareness" },
  PAGE_LIKES: { label: "Curtidas na página", unit: "curtida", keys: ["like"], kind: "awareness" },
};
const DEFAULT_RESULT = { label: "Cliques no link", unit: "clique", keys: ["link_click"], kind: "traffic" };
const CONV_KEY = "onsite_conversion.messaging_conversation_started_7d";

/* ================================================================ estado */
const state = {
  config: null, meta: null, organic: null,
  since: null, until: null, preset: "max", prevSince: null, prevUntil: null,
  targets: {}, section: "exec",
  creativeFilter: { campaign: "all", quality: "all" },
};
const idx = { campaigns: new Map(), adsets: new Map(), ads: new Map(), resultDefByCampaign: new Map(), kindByCampaign: new Map(), campaignByAd: new Map() };

function loadTargets() {
  const base = { ...state.config.targets, meta_monthly: state.config.budget.meta_monthly };
  try {
    const saved = JSON.parse(localStorage.getItem("lapidation.targets") || "null");
    if (saved && typeof saved === "object") return { ...base, ...saved };
  } catch { /* ignore */ }
  return base;
}
function saveTargets(t) { try { localStorage.setItem("lapidation.targets", JSON.stringify(t)); } catch { /* ignore */ } }

/* ============================================================== agregação */
function emptyAgg() { return { spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0, thruplays: 0, actions: {}, days: new Set() }; }
function addRow(agg, r) {
  agg.spend += r.spend || 0; agg.impressions += r.impressions || 0; agg.reach += r.reach || 0;
  agg.clicks += r.clicks || 0; agg.link_clicks += r.link_clicks || 0; agg.thruplays += r.thruplays || 0;
  if (r.date) agg.days.add(r.date);
  for (const [k, v] of Object.entries(r.actions || {})) agg.actions[k] = (agg.actions[k] || 0) + v;
  return agg;
}
function finish(agg) {
  agg.cpm = div(agg.spend * 1000, agg.impressions);
  agg.ctr = div(agg.clicks * 100, agg.impressions);
  agg.cpc = div(agg.spend, agg.clicks);
  agg.link_ctr = div(agg.link_clicks * 100, agg.impressions);
  agg.frequency = div(agg.impressions, agg.reach);
  agg.conversations = agg.actions[CONV_KEY] || 0;
  agg.cost_per_conversation = div(agg.spend, agg.conversations);
  return agg;
}
function aggregate(rows) { const a = emptyAgg(); for (const r of rows) addRow(a, r); return finish(a); }
function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = r[key]; if (!m.has(k)) m.set(k, emptyAgg()); addRow(m.get(k), r); }
  for (const v of m.values()) finish(v);
  return m;
}
function rowsIn(since, until, rows = state.meta.daily) { return rows.filter((r) => r.date >= since && r.date <= until); }

function resolveResultDef(def) {
  if (def.metric) return { ...def, key: null };
  const seen = new Set(state.meta.action_types_seen || []);
  const key = def.keys.find((k) => seen.has(k)) || def.keys[0];
  return { ...def, key, proxy: key !== def.keys[0] && def.keys[0] === "profile_visit" ? "cliques no link como proxy" : key !== def.keys[0] ? `usando ${key}` : null };
}
function resultDefFor(campaignId) { return idx.resultDefByCampaign.get(campaignId) || resolveResultDef(DEFAULT_RESULT); }
function resultsOf(agg, def) {
  if (!def) return 0;
  if (def.metric) return agg[def.metric] || 0;
  return agg.actions[def.key] || 0;
}
function costPerResult(agg, def) {
  const r = resultsOf(agg, def);
  if (def.per) return div(agg.spend * def.per, r);
  return div(agg.spend, r);
}
function targetFor(def) {
  if (!def) return null;
  if (def.target) return state.targets[def.target] || null;
  if (def.kind === "awareness" && def.per) return state.targets.cpm_topo_max || null;
  return null;
}
function assess(agg, def, { minSpend } = {}) {
  /* devolve {level, text, ratio} — regra única usada em tabelas, cards e alertas */
  const min = minSpend ?? state.targets.min_spend_for_alert ?? 30;
  const results = resultsOf(agg, def);
  const cpr = costPerResult(agg, def);
  const target = targetFor(def);
  if (agg.spend <= 0) return { level: "neutral", text: "Sem gasto no período" };
  if (results === 0) {
    if (agg.spend >= min) return { level: "crit", text: `${fmt.brl(agg.spend)} sem nenhum resultado — pausar ou revisar`, ratio: null };
    return { level: "warn", text: "Sem resultado, mas gasto baixo — observar", ratio: null };
  }
  if (!target || !ok(cpr)) return { level: "neutral", text: "Sem meta definida para este objetivo" };
  const ratio = cpr / target;
  if (ratio <= 1) return { level: "ok", text: "Dentro da meta — manter", ratio };
  if (ratio <= 1.6) return { level: "warn", text: `Custo ${nfDec1.format(ratio)}× a meta — otimizar segmentação/criativo`, ratio };
  return { level: "crit", text: `Custo ${nfDec1.format(ratio)}× a meta — reduzir verba e revisar`, ratio };
}

/* ================================================================ índices */
function buildIndexes() {
  const m = state.meta;
  idx.campaigns = new Map(m.campaigns.map((c) => [c.id, c]));
  idx.adsets = new Map(m.adsets.map((s) => [s.id, s]));
  idx.ads = new Map(m.ads.map((a) => [a.id, a]));
  for (const a of m.ads) idx.campaignByAd.set(a.id, a.campaign_id);
  const LEAD_GOALS = new Set(["CONVERSATIONS", "LEAD_GENERATION", "QUALITY_LEAD", "QUALITY_CALL", "OFFSITE_CONVERSIONS", "VALUE"]);
  const LEAD_OBJ = new Set(["OUTCOME_LEADS", "OUTCOME_SALES", "MESSAGES", "LEAD_GENERATION", "CONVERSIONS"]);
  for (const c of m.campaigns) {
    const goals = m.adsets.filter((s) => s.campaign_id === c.id).map((s) => s.optimization_goal).filter(Boolean);
    const goal = goals[0];
    let def = GOAL_RESULT[goal];
    if (!def) {
      if (LEAD_OBJ.has(c.objective)) def = GOAL_RESULT.CONVERSATIONS;
      else if (c.objective === "OUTCOME_AWARENESS" || c.objective === "REACH") def = GOAL_RESULT.REACH;
      else if (c.objective === "OUTCOME_ENGAGEMENT") def = GOAL_RESULT.POST_ENGAGEMENT;
      else def = DEFAULT_RESULT;
    }
    idx.resultDefByCampaign.set(c.id, resolveResultDef(def));
    idx.kindByCampaign.set(c.id, goals.some((g) => LEAD_GOALS.has(g)) || LEAD_OBJ.has(c.objective) ? "captacao" : "topo");
  }
}
const isCaptacao = (campaignId) => idx.kindByCampaign.get(campaignId) === "captacao";

/* ================================================================ período */
function computePeriod() {
  const m = state.meta;
  const last = m.range?.until || dateToIso(new Date());
  const first = m.range?.since || addDays(last, -29);
  let since, until = last;
  switch (state.preset) {
    case "7": since = addDays(last, -6); break;
    case "14": since = addDays(last, -13); break;
    case "30": since = addDays(last, -29); break;
    case "month": since = monthStart(last); break;
    case "lastmonth": { const e = addDays(monthStart(last), -1); since = monthStart(e); until = e; break; }
    case "max": since = first; break;
    case "custom": since = state.since || first; until = state.until || last; break;
    default: since = first;
  }
  if (since < first && state.preset !== "custom") since = first;
  if (since > until) since = until;
  state.since = since; state.until = until;
  const len = daysBetween(since, until);
  state.prevUntil = addDays(since, -1);
  state.prevSince = addDays(since, -len);
}

/* ================================================================= charts */
let tooltipEl;
function showTooltip(x, y, title, rows) {
  tooltipEl.replaceChildren(h("div", { class: "tt-title", text: title }), ...rows.map((r) => h("div", { class: "tt-row" }, h("span", {}, r.color ? h("i", { style: undefined }) : null, r.label), h("b", { text: r.value }))));
  // cor dos marcadores via CSSOM (CSP proíbe style inline no HTML)
  $$(".tt-row i", tooltipEl).forEach((i, k) => { i.style.background = rows[k].color; });
  tooltipEl.hidden = false;
  const rect = tooltipEl.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + rect.width > window.innerWidth - 8) left = x - rect.width - 14;
  if (top + rect.height > window.innerHeight - 8) top = y - rect.height - 14;
  tooltipEl.style.left = left + "px"; tooltipEl.style.top = top + "px";
}
function hideTooltip() { tooltipEl.hidden = true; }

function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}
function roundedTop(x, y, w, hgt, r) {
  if (hgt <= 0) return "";
  r = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + hgt} Z`;
}

/** Gráfico de colunas (empilhadas ou não) ou linhas, com tooltip. */
function renderChart(container, { type = "bar", labels, series, stacked = true, format = fmt.int, target = null, targetLabel = "meta", height = 210 }) {
  container.replaceChildren();
  const W = Math.max(280, container.clientWidth || 600), H = height;
  const padL = 46, padR = 10, padT = 10, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = labels.length;
  const el = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  if (!n) { container.append(el); return; }
  let max = 0;
  for (let i = 0; i < n; i++) {
    if (type === "bar" && stacked) max = Math.max(max, sum(series, (s) => s.values[i] || 0));
    else for (const s of series) max = Math.max(max, s.values[i] || 0);
  }
  if (ok(target)) max = Math.max(max, target * 1.1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v) => padT + ih - (v / top) * ih;
  for (const t of ticks) {
    el.append(svg("line", { x1: padL, x2: W - padR, y1: y(t), y2: y(t), class: "grid-line" }));
    const tx = svg("text", { x: padL - 6, y: y(t) + 3, "text-anchor": "end" }); tx.textContent = fmt.compact(t); el.append(tx);
  }
  const slot = iw / n;
  const every = Math.max(1, Math.ceil(n / Math.floor(iw / 42)));
  for (let i = 0; i < n; i++) {
    if (i % every !== 0 && i !== n - 1) continue;
    const tx = svg("text", { x: padL + slot * (i + 0.5), y: H - 6, "text-anchor": "middle" }); tx.textContent = labels[i]; el.append(tx);
  }
  if (type === "bar") {
    const bw = Math.min(24 * (stacked ? 1 : series.length), slot * 0.72);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      series.forEach((s, si) => {
        const v = s.values[i] || 0; if (v <= 0) return;
        const x0 = stacked ? padL + slot * (i + 0.5) - bw / 2 : padL + slot * (i + 0.5) - bw / 2 + (bw / series.length) * si;
        const w = stacked ? bw : bw / series.length - 1;
        const yTop = y(acc + v), yBot = y(acc);
        const gap = stacked && acc > 0 ? 2 : 0;
        const isTop = stacked ? si === series.length - 1 || series.slice(si + 1).every((t) => !(t.values[i] > 0)) : true;
        const hh = Math.max(0, yBot - yTop - gap);
        el.append(isTop ? svg("path", { d: roundedTop(x0, yTop, w, hh, 4), fill: s.color }) : svg("rect", { x: x0, y: yTop, width: w, height: hh, fill: s.color }));
        acc += v;
      });
    }
  } else {
    series.forEach((s) => {
      const pts = [];
      for (let i = 0; i < n; i++) { const v = s.values[i]; if (ok(v)) pts.push([padL + slot * (i + 0.5), y(v)]); else pts.push(null); }
      let d = "", pen = false;
      for (const p of pts) { if (!p) { pen = false; continue; } d += (pen ? "L" : "M") + p[0] + "," + p[1]; pen = true; }
      el.append(svg("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      pts.forEach((p) => { if (p) el.append(svg("circle", { cx: p[0], cy: p[1], r: 4, fill: s.color, stroke: "#18181a", "stroke-width": 2 })); });
    });
  }
  if (ok(target)) {
    el.append(svg("line", { x1: padL, x2: W - padR, y1: y(target), y2: y(target), class: "target-line" }));
    const tx = svg("text", { x: W - padR, y: y(target) - 4, "text-anchor": "end" }); tx.textContent = `${targetLabel} ${format(target)}`; el.append(tx);
  }
  // camada de hover
  for (let i = 0; i < n; i++) {
    const hit = svg("rect", { x: padL + slot * i, y: padT, width: slot, height: ih, class: "hit" });
    const show = (ev) => showTooltip(ev.clientX, ev.clientY, labels[i], series.map((s) => ({ label: s.name, value: format(s.values[i] || 0), color: s.color })));
    hit.addEventListener("mousemove", show); hit.addEventListener("mouseleave", hideTooltip);
    el.append(hit);
  }
  container.append(el);
}
function chartCard(title, subtitle, series, buildOpts) {
  const card = h("div", { class: "chart-card" });
  const head = h("div", { class: "chart-head" }, h("h3", {}, title, subtitle ? h("small", { text: subtitle }) : null));
  if (series.length >= 2) head.append(h("div", { class: "legend" }, ...series.map((s) => { const i = h("i"); i.style.background = s.color; return h("span", {}, i, s.name); })));
  const body = h("div", { class: "chart" });
  card.append(head, body);
  card._render = () => renderChart(body, { ...buildOpts, series });
  requestAnimationFrame(card._render);
  return card;
}

/* ============================================================ tiles/utils */
function tile({ label, value, sub, delta, accent, hero }) {
  return h("div", { class: `tile${accent ? " accent" : ""}` },
    h("div", { class: "label", text: label }),
    h("div", { class: `value${hero ? " hero" : ""}`, text: value }),
    (sub || delta) ? h("div", { class: "sub" }, delta || null, sub || null) : null,
  );
}
function block(title, subtitle, ...children) {
  return h("div", { class: "block" }, h("div", { class: "block-head" }, h("h2", {}, title, subtitle ? h("small", { text: subtitle }) : null)), ...children);
}
function progressBar(pct, level) {
  const p = h("div", { class: "progress" }); const i = h("i", { class: level || "" }); i.style.width = Math.max(0, Math.min(100, pct)) + "%"; p.append(i); return p;
}
function cprCell(agg, def) {
  const cpr = costPerResult(agg, def);
  const target = targetFor(def);
  const wrap = h("div", { class: "cpr" }, h("span", { text: ok(cpr) ? (def.per ? `${fmt.brl(cpr)}/mil` : fmt.brl(cpr)) : "—" }));
  if (ok(cpr) && target) {
    const ratio = cpr / target;
    const bar = h("div", { class: "bar" }); const i = h("i", { class: ratio <= 1 ? "" : ratio <= 1.6 ? "warn" : "crit" });
    i.style.width = Math.min(100, (1 / Math.max(ratio, 0.01)) * 60) + "%"; // 60% = na meta
    bar.append(i); wrap.append(bar);
  }
  return wrap;
}
function thumbOf(ad) { return ad?.creative?.image_url || ad?.creative?.thumbnail_url || null; }
function adLink(ad) { return ad?.creative?.instagram_permalink_url || ad?.preview_link || null; }

/* ===================================================== seção: executiva */
function renderExec() {
  const sec = $("#sec-exec"); sec.replaceChildren();
  const m = state.meta; const T = state.targets;
  const rows = rowsIn(state.since, state.until);
  const prevRows = rowsIn(state.prevSince, state.prevUntil);
  const all = aggregate(rows), prevAll = aggregate(prevRows);
  const cap = aggregate(rows.filter((r) => isCaptacao(r.campaign_id))), prevCap = aggregate(prevRows.filter((r) => isCaptacao(r.campaign_id)));
  const topo = aggregate(rows.filter((r) => !isCaptacao(r.campaign_id)));
  const presetKey = { 7: "last_7d", 14: "last_14d", 30: "last_30d", month: "this_month", lastmonth: "last_month", max: "maximum" }[state.preset];
  const exact = presetKey && m.presets?.[presetKey];
  const reach = exact?.reach ?? all.reach;
  const reachNote = exact ? "alcance exato (API)" : "soma dos alcances diários";

  /* --- controle de investimento ------------------------------------------- */
  const last = m.range.until;
  const monthRows = rowsIn(monthStart(last), last);
  const monthAgg = aggregate(monthRows);
  const dayN = +last.slice(8, 10), dim = daysInMonth(last);
  const budget = T.meta_monthly || 0;
  const pace = monthAgg.spend / Math.max(1, dayN);
  const projection = pace * dim;
  const remainingDays = dim - dayN;
  const needPace = remainingDays > 0 ? Math.max(0, budget - monthAgg.spend) / remainingDays : 0;
  const usedPct = budget ? (monthAgg.spend / budget) * 100 : 0;
  const paceLevel = !budget ? "" : projection > budget * 1.15 ? "crit" : projection > budget * 1.05 ? "warn" : "good";
  const byKindMonth = { cap: sum(monthRows.filter((r) => isCaptacao(r.campaign_id)), (r) => r.spend), topo: sum(monthRows.filter((r) => !isCaptacao(r.campaign_id)), (r) => r.spend) };
  const dailyBudgetTotal = sum(m.campaigns.filter((c) => c.effective_status === "ACTIVE"), (c) => c.daily_budget || 0) + sum(m.adsets.filter((s) => s.effective_status === "ACTIVE" && !(idx.campaigns.get(s.campaign_id)?.daily_budget > 0)), (s) => s.daily_budget || 0);

  const invest = h("div", { class: "grid c3" },
    h("div", { class: "tile accent" },
      h("div", { class: "label", text: `Verba do mês · ${MONTHS[+last.slice(5, 7) - 1]}` }),
      h("div", { class: "value hero", text: fmt.brl(monthAgg.spend) }),
      h("div", { class: "sub" }, `gastos de ${fmt.brl(budget)} · ${fmt.dec1(usedPct)}% usado`, badge(paceLevel === "good" ? "ok" : paceLevel === "warn" ? "warn" : paceLevel === "crit" ? "crit" : "neutral", paceLevel === "good" ? "no ritmo" : paceLevel === "warn" ? "ritmo alto" : paceLevel === "crit" ? "acima da verba" : "sem verba definida")),
      progressBar(usedPct, paceLevel),
      h("div", { class: "split" },
        h("div", { class: "split-row" }, h("span", {}, spanDot("var(--meta)"), "Captação"), progressBar(budget ? (byKindMonth.cap / budget) * 100 : 0), h("b", { text: fmt.brl(byKindMonth.cap) })),
        h("div", { class: "split-row" }, h("span", {}, spanDot("var(--s7)"), "Topo de funil"), progressBar(budget ? (byKindMonth.topo / budget) * 100 : 0), h("b", { text: fmt.brl(byKindMonth.topo) })),
      ),
    ),
    h("div", { class: "tile" },
      h("div", { class: "label", text: "Ritmo de gasto" }),
      h("div", { class: "value" }, fmt.brl(pace), h("span", { class: "faint", text: "/dia" })),
      h("div", { class: "sub", text: `Ciclo ${fmt.date(monthStart(last))} a ${fmt.date(monthEnd(last))} · dia ${dayN} de ${dim}` }),
      h("div", { class: "sub" }, "Projeção do mês: ", h("b", { text: fmt.brl(projection) }), budget ? (projection > budget ? badge("warn", `${fmt.brl(projection - budget)} acima`) : badge("ok", `${fmt.brl(budget - projection)} sobram`)) : null),
      remainingDays > 0 ? h("div", { class: "sub" }, `Cabe ${fmt.brl(needPace)}/dia nos ${remainingDays} dias restantes`) : h("div", { class: "sub", text: "Mês encerrado" }),
      h("div", { class: "sub faint", text: `Orçamento diário configurado nas campanhas ativas: ${fmt.brl(dailyBudgetTotal)}/dia (${fmt.brl(dailyBudgetTotal * 30)}/30d)` }),
    ),
    h("div", { class: "tile" },
      h("div", { class: "label", text: "Conta de anúncios" }),
      h("div", { class: "value", text: m.account.balance > 0 ? fmt.brl(m.account.balance) : fmt.brl(m.account.amount_spent_lifetime) }),
      h("div", { class: "sub", text: m.account.balance > 0 ? "saldo em conta (pré-pago)" : "investido desde o início da conta" }),
      h("div", { class: "sub" }, m.account.status === 1 ? badge("ok", "conta ativa") : badge("crit", `status ${m.account.status}`), m.account.spend_cap > 0 ? `limite de gasto ${fmt.brl(m.account.spend_cap)}` : null),
      h("div", { class: "sub faint", text: `${m.campaigns.filter((c) => c.effective_status === "ACTIVE").length} campanhas ativas de ${m.campaigns.length} · fuso ${m.account.timezone}` }),
    ),
  );

  /* --- o que está acontecendo -------------------------------------------- */
  const kpis = h("div", { class: "grid c6" },
    tile({ label: "Investimento no período", value: fmt.brl(all.spend), delta: deltaBadge(all.spend, prevAll.spend, { goodWhenUp: false, kind: "brl" }), sub: `Captação ${fmt.brl(cap.spend)} · Topo ${fmt.brl(topo.spend)}`, accent: true }),
    tile({ label: "Conversas iniciadas (WhatsApp)", value: fmt.int(all.conversations), delta: deltaBadge(all.conversations, prevAll.conversations), sub: `${fmt.dec1(div(all.conversations, all.days.size) || 0)} por dia` , accent: true }),
    tile({ label: "Custo por conversa", value: fmt.brl(cap.cost_per_conversation), delta: deltaBadge(cap.cost_per_conversation, prevCap.cost_per_conversation, { goodWhenUp: false, kind: "brl" }), sub: h("span", {}, `Meta ${fmt.brl(T.cost_per_conversation)} `, ok(cap.cost_per_conversation) ? badge(cap.cost_per_conversation <= T.cost_per_conversation ? "ok" : cap.cost_per_conversation <= T.cost_per_conversation * 1.6 ? "warn" : "crit", cap.cost_per_conversation <= T.cost_per_conversation ? "na meta" : "atenção") : null) }),
    tile({ label: "Alcance", value: fmt.int(reach), delta: deltaBadge(all.reach, prevAll.reach), sub: `${reachNote} · freq. ${fmt.dec(exact?.frequency ?? all.frequency)}` }),
    tile({ label: "Cliques no link", value: fmt.int(all.link_clicks), delta: deltaBadge(all.link_clicks, prevAll.link_clicks), sub: `CTR ${fmt.pct(all.ctr)} · CPC ${fmt.brl(all.cpc)}` }),
    tile({ label: "CPM médio", value: fmt.brl(all.cpm), delta: deltaBadge(all.cpm, prevAll.cpm, { goodWhenUp: false, kind: "brl" }), sub: `${fmt.int(all.impressions)} impressões` }),
  );

  const capDef = resolveResultDef(GOAL_RESULT.CONVERSATIONS);
  const metaBar = h("div", { class: "platform-bar" },
    h("div", { class: "head meta" }, h("span", {}, "Meta Ads · captação ", ok(cap.cost_per_conversation) ? badge(assess(cap, capDef).level, assess(cap, capDef).level === "ok" ? "na meta" : assess(cap, capDef).level === "warn" ? "atenção" : "crítico") : null), h("span", { class: "meta-target", text: `meta ${fmt.brl(T.cost_per_conversation)} por conversa` })),
    h("div", { class: "body" },
      h("div", {}, h("div", { class: "v", text: fmt.brl(cap.spend) }), h("div", { class: "k", text: "investido em captação" })),
      h("div", {}, h("div", { class: "v", text: fmt.int(cap.conversations) }), h("div", { class: "k", text: "conversas iniciadas" })),
      h("div", {}, h("div", { class: "v", text: fmt.brl(cap.cost_per_conversation) }), h("div", { class: "k", text: "custo por conversa" })),
    ),
  );
  const topoBar = h("div", { class: "platform-bar" },
    h("div", { class: "head", style: undefined }, h("span", {}, "Meta Ads · topo de funil"), h("span", { class: "meta-target faint", text: "alcance, reconhecimento e visitas ao perfil" })),
    h("div", { class: "body" },
      h("div", {}, h("div", { class: "v", text: fmt.brl(topo.spend) }), h("div", { class: "k", text: "investido" })),
      h("div", {}, h("div", { class: "v", text: fmt.int(topo.reach) }), h("div", { class: "k", text: "alcance (soma diária)" })),
      h("div", {}, h("div", { class: "v", text: fmt.brl(topo.cpm) }), h("div", { class: "k", text: "CPM" })),
    ),
  );
  $$(".head", topoBar)[0].classList.add("meta"); $$(".head", topoBar)[0].style.background = "var(--s7)";

  /* --- evolução diária ----------------------------------------------------- */
  const days = []; for (let d = state.since; d <= state.until; d = addDays(d, 1)) days.push(d);
  const byDay = groupBy(rows, "date");
  const byDayCap = groupBy(rows.filter((r) => isCaptacao(r.campaign_id)), "date");
  const byDayTopo = groupBy(rows.filter((r) => !isCaptacao(r.campaign_id)), "date");
  const labels = days.map(fmt.dm);
  const charts = h("div", { class: "grid c3" },
    chartCard("Conversas por dia", "conversas iniciadas no WhatsApp", [{ name: "Conversas", color: "var(--meta)", values: days.map((d) => byDay.get(d)?.conversations || 0) }], { labels, type: "bar" }),
    chartCard("Investimento por dia", "captação e topo de funil", [
      { name: "Captação", color: "#3987e5", values: days.map((d) => byDayCap.get(d)?.spend || 0) },
      { name: "Topo de funil", color: "#9085e9", values: days.map((d) => byDayTopo.get(d)?.spend || 0) },
    ], { labels, type: "bar", stacked: true, format: fmt.brl }),
    chartCard("Custo por conversa, por dia", "gasto em captação ÷ conversas do dia", [{ name: "Custo/conversa", color: "#c98500", values: days.map((d) => byDayCap.get(d)?.cost_per_conversation ?? null) }], { labels, type: "line", format: fmt.brl, target: T.cost_per_conversation }),
  );

  /* --- histórico mensal ---------------------------------------------------- */
  const months = groupBy(m.daily.map((r) => ({ ...r, month: r.date.slice(0, 7) })), "month");
  const monthsCap = groupBy(m.daily.filter((r) => isCaptacao(r.campaign_id)).map((r) => ({ ...r, month: r.date.slice(0, 7) })), "month");
  const monthKeys = Array.from(months.keys()).sort();
  const histTable = h("div", { class: "table-wrap" }, h("table", {},
    h("thead", {}, h("tr", {}, h("th", { text: "Mês" }), h("th", { text: "Investimento" }), h("th", { text: "Captação" }), h("th", { text: "Conversas" }), h("th", { text: "Custo/conversa" }), h("th", { text: "Impressões" }), h("th", { text: "Alcance (soma)" }), h("th", { text: "CPM" }), h("th", { text: "Cliques" }), h("th", { text: "CTR" }), h("th", { text: "CPC" }))),
    h("tbody", {}, ...monthKeys.map((k) => {
      const a = months.get(k), c = monthsCap.get(k) || finish(emptyAgg());
      const partial = k === last.slice(0, 7);
      return h("tr", { class: partial ? "parcial" : "" },
        h("td", {}, `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)} `, partial ? h("span", { class: "badge warn", text: "parcial" }) : null),
        h("td", { text: fmt.brl(a.spend) }), h("td", { text: fmt.brl(c.spend) }), h("td", { text: fmt.int(a.conversations) }), h("td", { text: fmt.brl(c.cost_per_conversation) }),
        h("td", { text: fmt.int(a.impressions) }), h("td", { text: fmt.int(a.reach) }), h("td", { text: fmt.brl(a.cpm) }), h("td", { text: fmt.int(a.clicks) }), h("td", { text: fmt.pct(a.ctr) }), h("td", { text: fmt.brl(a.cpc) }));
    })),
  ));

  /* --- onde está o resultado ----------------------------------------------- */
  const byAd = groupBy(rows, "ad_id");
  const adRows = Array.from(byAd.entries()).map(([id, a]) => ({ id, ad: idx.ads.get(id), agg: a, def: resultDefFor(idx.campaignByAd.get(id)) })).filter((x) => x.ad);
  const best = adRows.filter((x) => x.def.kind === "lead" && resultsOf(x.agg, x.def) >= 2).sort((a, b) => costPerResult(a.agg, a.def) - costPerResult(b.agg, b.def)).slice(0, 6);
  const noReturn = adRows.filter((x) => x.def.kind === "lead" && resultsOf(x.agg, x.def) === 0 && x.agg.spend > 0).sort((a, b) => b.agg.spend - a.agg.spend).slice(0, 6);
  const byCamp = groupBy(rows, "campaign_id");
  const campRows = Array.from(byCamp.entries()).map(([id, a]) => ({ id, c: idx.campaigns.get(id), agg: a, def: resultDefFor(id) })).filter((x) => x.c);
  const offTarget = campRows.map((x) => ({ ...x, as: assess(x.agg, x.def) })).filter((x) => x.as.level === "crit" || x.as.level === "warn").sort((a, b) => b.agg.spend - a.agg.spend).slice(0, 6);

  const listItem = (rank, cls, thumb, name, sub, link) => h("div", { class: "list-item" },
    h("span", { class: `rank ${cls}`, text: rank }),
    thumb ? h("img", { class: "thumb", src: thumb, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null,
    h("div", { class: "txt" }, link ? h("div", { class: "n" }, h("a", { href: link, target: "_blank", rel: "noopener noreferrer", text: name })) : h("div", { class: "n", text: name }), h("div", { class: "s", text: sub })),
  );
  const results = h("div", { class: "grid c3" },
    h("div", { class: "card" }, h("h3", {}, "🏆 Criativos mais eficientes"), h("div", { class: "muted", text: "menor custo por conversa, com ao menos 2 conversas" }),
      best.length ? h("div", { class: "list" }, ...best.map((x, i) => listItem(i + 1, "good", thumbOf(x.ad), x.ad.name, `${fmt.brl(costPerResult(x.agg, x.def))} · ${fmt.int(resultsOf(x.agg, x.def))} conversas · ${fmt.brl(x.agg.spend)}`, adLink(x.ad)))) : h("div", { class: "empty", text: "Ainda não há criativos com 2+ conversas no período." })),
    h("div", { class: "card" }, h("h3", {}, "🔥 Dinheiro sem retorno"), h("div", { class: "muted", text: `${fmt.brl(sum(noReturn, (x) => x.agg.spend))} em ${noReturn.length} criativos de captação com zero conversa` }),
      noReturn.length ? h("div", { class: "list" }, ...noReturn.map((x, i) => listItem(i + 1, "bad", thumbOf(x.ad), x.ad.name, `${fmt.brl(x.agg.spend)} · zero conversa · ${fmt.int(x.agg.link_clicks)} cliques`, adLink(x.ad)))) : h("div", { class: "empty", text: "Nenhum criativo de captação gastando sem resultado." })),
    h("div", { class: "card" }, h("h3", {}, "⚠️ Campanhas fora da meta"), h("div", { class: "muted", text: `${fmt.brl(sum(offTarget, (x) => x.agg.spend))} em ${offTarget.length} campanhas` }),
      offTarget.length ? h("div", { class: "list" }, ...offTarget.map((x, i) => listItem(i + 1, x.as.level === "crit" ? "bad" : "", null, x.c.name, `${fmt.brl(x.agg.spend)} · ${x.def.label}: ${fmt.int(resultsOf(x.agg, x.def))} · ${x.as.text}`))) : h("div", { class: "empty", text: "Todas as campanhas com meta estão dentro do esperado." })),
  );

  /* --- qual ação tomar ----------------------------------------------------- */
  const alerts = buildAlerts({ rows, prevRows, cap, prevCap, all, campRows, adRows, projection, budget, monthAgg });
  const actions = h("div", { class: "alerts" }, ...(alerts.length ? alerts.map((a) => h("div", { class: `alert ${a.level}` }, h("div", { class: "t" }, badge(a.level, a.level === "crit" ? "crítico" : a.level === "warn" ? "atenção" : "na meta"), a.title), a.detail ? h("div", { class: "d", text: a.detail }) : null)) : [h("div", { class: "empty", text: "Sem alertas para o período." })]));

  sec.append(
    block("Controle de investimento", "ciclo mensal e distribuição do gasto", invest),
    block("O que está acontecendo", `volume e eficiência · ${fmt.date(state.since)} a ${fmt.date(state.until)}`, kpis, h("div", { class: "grid c2" }, metaBar, topoBar)),
    block("Como está evoluindo", "dia a dia do período selecionado", charts),
    block("Histórico mensal", "mês a mês desde o início — independe do filtro de período", histTable, h("div", { class: "faint", text: "“Captação” = campanhas com objetivo de conversa/cadastro/venda. Topo de funil (alcance, reconhecimento, visitas ao perfil) entra no investimento total, mas não no custo por conversa." })),
    block("Onde está o resultado", "e onde o dinheiro está parado", results),
    block("Qual ação tomar", "alertas priorizados por dinheiro em jogo", actions),
  );
}
function spanDot(color) { const i = h("i", { class: "dot" }); i.style.background = color; return i; }

function buildAlerts({ rows, prevRows, cap, prevCap, campRows, adRows, projection, budget, monthAgg }) {
  const T = state.targets; const out = [];
  const money = (x) => x.agg.spend;
  const crit = campRows.map((x) => ({ ...x, as: assess(x.agg, x.def) })).filter((x) => x.as.level === "crit");
  const warn = campRows.map((x) => ({ ...x, as: assess(x.agg, x.def) })).filter((x) => x.as.level === "warn");
  const okc = campRows.map((x) => ({ ...x, as: assess(x.agg, x.def) })).filter((x) => x.as.level === "ok");
  if (crit.length) out.push({ level: "crit", title: `Meta: ${fmt.brl(sum(crit, money))} em ${crit.length} campanha${crit.length > 1 ? "s" : ""} em situação crítica`, detail: crit.sort((a, b) => money(b) - money(a)).slice(0, 3).map((x) => `${x.c.name} (${fmt.brl(x.agg.spend)}, ${x.as.text.toLowerCase()})`).join(" · ") });
  if (warn.length) out.push({ level: "warn", title: `Meta: ${fmt.brl(sum(warn, money))} em ${warn.length} campanha${warn.length > 1 ? "s" : ""} acima da meta`, detail: warn.sort((a, b) => money(b) - money(a)).slice(0, 3).map((x) => `${x.c.name} (${x.def.label.toLowerCase()} a ${fmt.brl(costPerResult(x.agg, x.def))})`).join(" · ") });
  const noRet = adRows.filter((x) => x.def.kind === "lead" && resultsOf(x.agg, x.def) === 0 && x.agg.spend >= (T.min_spend_for_alert || 30));
  if (noRet.length) out.push({ level: "crit", title: `${fmt.brl(sum(noRet, money))} em ${noRet.length} criativo${noRet.length > 1 ? "s" : ""} de captação sem nenhuma conversa`, detail: "Pausar e substituir por variações do criativo que melhor converte. " + noRet.slice(0, 3).map((x) => `${x.ad.name} (${fmt.brl(x.agg.spend)})`).join(" · ") });
  if (ok(cap.cost_per_conversation) && ok(prevCap.cost_per_conversation) && prevCap.conversations >= 3 && cap.cost_per_conversation > prevCap.cost_per_conversation * 1.25) {
    out.push({ level: "warn", title: `Custo por conversa subiu ${nfDec1.format(((cap.cost_per_conversation / prevCap.cost_per_conversation) - 1) * 100)}% vs. período anterior`, detail: `${fmt.brl(prevCap.cost_per_conversation)} → ${fmt.brl(cap.cost_per_conversation)}. Verificar saturação de público (frequência), troca de criativo ou queda de CTR.` });
  }
  const highFreq = campRows.filter((x) => x.agg.frequency > (T.frequency_max || 2.5) && x.agg.spend > 20 && x.def.kind !== "awareness");
  if (highFreq.length) out.push({ level: "warn", title: `Frequência acima de ${fmt.dec1(T.frequency_max)} em ${highFreq.length} campanha${highFreq.length > 1 ? "s" : ""}`, detail: "Público saturando: ampliar segmentação ou renovar criativos. " + highFreq.map((x) => `${x.c.name} (${fmt.dec(x.agg.frequency)}×)`).join(" · ") });
  const lowCtr = campRows.filter((x) => x.def.kind !== "awareness" && x.agg.impressions > 1000 && x.agg.ctr < (T.ctr_min || 1));
  if (lowCtr.length) out.push({ level: "warn", title: `CTR abaixo de ${fmt.pct(T.ctr_min || 1)} em ${lowCtr.length} campanha${lowCtr.length > 1 ? "s" : ""}`, detail: "Criativo/gancho pouco atrativo para o público. " + lowCtr.map((x) => `${x.c.name} (${fmt.pct(x.agg.ctr)})`).join(" · ") });
  if (budget && projection > budget * 1.15) out.push({ level: "crit", title: `Projeção do mês (${fmt.brl(projection)}) estoura a verba de ${fmt.brl(budget)}`, detail: `Já gastos ${fmt.brl(monthAgg.spend)}. Reduzir orçamento diário das campanhas de topo de funil primeiro.` });
  else if (budget && projection < budget * 0.7 && rows.length) out.push({ level: "warn", title: `Projeção do mês (${fmt.brl(projection)}) fica bem abaixo da verba de ${fmt.brl(budget)}`, detail: "Há espaço para escalar as campanhas que estão na meta ou testar novos criativos." });
  if (okc.length) out.push({ level: "ok", title: `Meta: ${okc.length} campanha${okc.length > 1 ? "s" : ""} dentro da meta`, detail: okc.map((x) => `${x.c.name} (${x.def.label.toLowerCase()} a ${fmt.brl(costPerResult(x.agg, x.def))}${x.def.per ? "/mil" : ""}, ${fmt.int(resultsOf(x.agg, x.def))} resultados)`).join(" · ") });
  return out;
}

/* ======================================================= seção: Meta Ads */
function renderMeta() {
  const sec = $("#sec-meta"); sec.replaceChildren();
  const m = state.meta; const T = state.targets;
  const rows = rowsIn(state.since, state.until), prevRows = rowsIn(state.prevSince, state.prevUntil);
  const byCamp = groupBy(rows, "campaign_id"), prevByCamp = groupBy(prevRows, "campaign_id");
  const cap = aggregate(rows.filter((r) => isCaptacao(r.campaign_id)));
  const capDef = resolveResultDef(GOAL_RESULT.CONVERSATIONS);
  const campRows = m.campaigns.map((c) => ({ c, agg: byCamp.get(c.id) || finish(emptyAgg()), prev: prevByCamp.get(c.id), def: resultDefFor(c.id) }))
    .filter((x) => x.agg.spend > 0 || x.c.effective_status === "ACTIVE")
    .sort((a, b) => b.agg.spend - a.agg.spend);
  const withSpend = campRows.filter((x) => x.agg.spend > 0);
  const onTarget = withSpend.filter((x) => assess(x.agg, x.def).level === "ok");
  const bestCap = withSpend.filter((x) => x.def.kind === "lead" && resultsOf(x.agg, x.def) > 0).sort((a, b) => costPerResult(a.agg, a.def) - costPerResult(b.agg, b.def))[0];

  const head = h("div", { class: "grid c4" },
    h("div", { class: "platform-bar", style: undefined },
      h("div", { class: "head meta" }, h("span", {}, "Meta Ads ", ok(cap.cost_per_conversation) ? badge(assess(cap, capDef).level, assess(cap, capDef).level === "ok" ? "na meta" : "atenção") : null), h("span", { class: "meta-target", text: `meta ${fmt.brl(T.cost_per_conversation)}` })),
      h("div", { class: "body" },
        h("div", {}, h("div", { class: "v", text: fmt.brl(cap.spend) }), h("div", { class: "k", text: "investido em captação" })),
        h("div", {}, h("div", { class: "v", text: fmt.int(cap.conversations) }), h("div", { class: "k", text: "conversas" })),
        h("div", {}, h("div", { class: "v", text: fmt.brl(cap.cost_per_conversation) }), h("div", { class: "k", text: "custo por conversa" })),
      )),
    tile({ label: "Campanhas", value: fmt.int(campRows.length), sub: `${withSpend.length} com investimento no período` }),
    tile({ label: "Dentro da meta", value: fmt.int(onTarget.length), sub: h("span", {}, `de ${withSpend.length}`, withSpend.length ? badge(onTarget.length === withSpend.length ? "ok" : onTarget.length ? "warn" : "crit", `${Math.round((onTarget.length / withSpend.length) * 100)}%`) : null) }),
    tile({ label: "Melhor campanha de captação", value: bestCap ? fmt.brl(costPerResult(bestCap.agg, bestCap.def)) : "—", sub: bestCap ? h("span", {}, bestCap.c.name, " ", badge(assess(bestCap.agg, bestCap.def).level, "por conversa")) : "sem conversas no período" }),
  );

  const table = h("div", { class: "table-wrap" }, h("table", {},
    h("thead", {}, h("tr", {}, h("th", { text: "Status" }), h("th", { class: "l", text: "Campanha" }), h("th", { text: "Orçam./dia" }), h("th", { text: "Result." }), h("th", { text: "Custo/result." }), h("th", { text: "Impress." }), h("th", { text: "Alcance" }), h("th", { text: "CPM" }), h("th", { text: "CTR" }), h("th", { text: "Cliques" }), h("th", { text: "CPC" }), h("th", { text: "Gasto" }), h("th", { class: "l", text: "Ação" }))),
    h("tbody", {}, ...campRows.map((x) => campaignRow(x))),
  ));

  /* conjuntos por campanha */
  const byAdset = groupBy(rows, "adset_id"), prevByAdset = groupBy(prevRows, "adset_id");
  const groups = campRows.map((x) => {
    const sets = m.adsets.filter((s) => s.campaign_id === x.c.id).map((s) => ({ c: s, agg: byAdset.get(s.id) || finish(emptyAgg()), prev: prevByAdset.get(s.id), def: x.def, parent: x.c })).filter((y) => y.agg.spend > 0 || y.c.effective_status === "ACTIVE").sort((a, b) => b.agg.spend - a.agg.spend);
    if (!sets.length) return null;
    const details = h("details", { open: x === campRows[0] ? "" : null },
      h("summary", { class: "group-head" }, h("span", {}, x.c.name), h("small", { text: `${sets.length} conjunto${sets.length > 1 ? "s" : ""} · ${fmt.brl(x.agg.spend)} · ${x.def.label.toLowerCase()}: ${fmt.int(resultsOf(x.agg, x.def))} · ${sets.filter((s) => assess(s.agg, s.def).level === "ok").length} na meta` })),
      h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: "Status" }), h("th", { class: "l", text: "Conjunto" }), h("th", { text: "Orçam./dia" }), h("th", { text: "Result." }), h("th", { text: "Custo/result." }), h("th", { text: "Impress." }), h("th", { text: "Alcance" }), h("th", { text: "CPM" }), h("th", { text: "CTR" }), h("th", { text: "Cliques" }), h("th", { text: "CPC" }), h("th", { text: "Gasto" }), h("th", { class: "l", text: "Ação" }))),
        h("tbody", {}, ...sets.map((y) => campaignRow(y, true)))),
    );
    return details;
  }).filter(Boolean);

  /* breakdowns (últimos 30 dias) */
  const bd = m.breakdowns || {};
  const bdCards = [];
  if (bd.age_gender?.length) {
    const map = new Map();
    for (const r of bd.age_gender) { const k = `${r.age} · ${r.gender === "female" ? "F" : r.gender === "male" ? "M" : "?"}`; if (!map.has(k)) map.set(k, emptyAgg()); addRow(map.get(k), r); }
    const list = Array.from(map.entries()).map(([k, a]) => [k, finish(a)]).sort((a, b) => b[1].spend - a[1].spend).slice(0, 10);
    bdCards.push(h("div", { class: "table-wrap" }, h("div", { class: "group-head" }, h("span", { text: "Idade e gênero" }), h("small", { text: "últimos 30 dias · todas as campanhas" })),
      h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: "Faixa" }), h("th", { text: "Gasto" }), h("th", { text: "Conversas" }), h("th", { text: "Custo/conv." }), h("th", { text: "CTR" }))),
        h("tbody", {}, ...list.map(([k, a]) => h("tr", {}, h("td", { text: k }), h("td", { text: fmt.brl(a.spend) }), h("td", { text: fmt.int(a.conversations) }), h("td", { text: fmt.brl(a.cost_per_conversation) }), h("td", { text: fmt.pct(a.ctr) })))))));
  }
  if (bd.region?.length) {
    const map = new Map();
    for (const r of bd.region) { const k = r.region || "—"; if (!map.has(k)) map.set(k, emptyAgg()); addRow(map.get(k), r); }
    const list = Array.from(map.entries()).map(([k, a]) => [k, finish(a)]).sort((a, b) => b[1].spend - a[1].spend).slice(0, 10);
    bdCards.push(h("div", { class: "table-wrap" }, h("div", { class: "group-head" }, h("span", { text: "Região (estado)" }), h("small", { text: "últimos 30 dias" })),
      h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: "Região" }), h("th", { text: "Gasto" }), h("th", { text: "Conversas" }), h("th", { text: "Custo/conv." }), h("th", { text: "CTR" }))),
        h("tbody", {}, ...list.map(([k, a]) => h("tr", {}, h("td", { text: k }), h("td", { text: fmt.brl(a.spend) }), h("td", { text: fmt.int(a.conversations) }), h("td", { text: fmt.brl(a.cost_per_conversation) }), h("td", { text: fmt.pct(a.ctr) })))))));
  }
  if (bd.platform_position?.length) {
    const map = new Map();
    for (const r of bd.platform_position) { const k = `${r.publisher_platform || "?"} · ${(r.platform_position || "").replace(/_/g, " ")}`; if (!map.has(k)) map.set(k, emptyAgg()); addRow(map.get(k), r); }
    const list = Array.from(map.entries()).map(([k, a]) => [k, finish(a)]).sort((a, b) => b[1].spend - a[1].spend).slice(0, 10);
    bdCards.push(h("div", { class: "table-wrap" }, h("div", { class: "group-head" }, h("span", { text: "Posicionamento" }), h("small", { text: "últimos 30 dias" })),
      h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: "Posicionamento" }), h("th", { text: "Gasto" }), h("th", { text: "Conversas" }), h("th", { text: "Custo/conv." }), h("th", { text: "CTR" }))),
        h("tbody", {}, ...list.map(([k, a]) => h("tr", {}, h("td", { text: k }), h("td", { text: fmt.brl(a.spend) }), h("td", { text: fmt.int(a.conversations) }), h("td", { text: fmt.brl(a.cost_per_conversation) }), h("td", { text: fmt.pct(a.ctr) })))))));
  }

  sec.append(
    block("Meta Ads", `${fmt.date(state.since)} a ${fmt.date(state.until)} · meta de ${fmt.brl(T.cost_per_conversation)} por conversa iniciada`, head, table),
    block("Conjuntos por campanha", "orçamento é definido no conjunto quando a campanha não usa CBO", ...(groups.length ? groups.map((g) => h("div", { class: "table-wrap" }, g)) : [h("div", { class: "empty", text: "Sem conjuntos com dados no período." })])),
    bdCards.length ? block("Quem está respondendo", "distribuição do gasto e das conversas", h("div", { class: "grid c3" }, ...bdCards)) : null,
  );
}
function campaignRow(x, isAdset = false) {
  const { c, agg, prev, def } = x;
  const as = assess(agg, def);
  const results = resultsOf(agg, def);
  const prevResults = prev ? resultsOf(prev, def) : null;
  const goal = isAdset ? c.optimization_goal : null;
  const tg = isAdset ? c.targeting : null;
  const nameCell = h("td", { class: "name" },
    h("div", { class: "n", text: c.name }),
    h("div", { class: "s", text: isAdset ? `${x.parent?.name || ""}${goal ? " · " + (GOAL_RESULT[goal]?.label || goal) : ""}` : `${OBJECTIVE_LABEL[c.objective] || c.objective || ""} · ${def.label}${def.proxy ? " (" + def.proxy + ")" : ""}` }),
    tg ? h("div", {}, tg.age_min ? h("span", { class: "tag", text: `${tg.age_min}–${tg.age_max || "65+"}` }) : null, tg.advantage_audience ? h("span", { class: "tag", text: "Advantage+" }) : null, ...(tg.geo || []).slice(0, 4).map((g) => h("span", { class: "tag", text: g }))) : null,
  );
  const budget = c.daily_budget > 0 ? fmt.brl(c.daily_budget) : c.lifetime_budget > 0 ? `${fmt.brl(c.lifetime_budget)} total` : "—";
  return h("tr", {},
    h("td", {}, statusBadge(c.effective_status, c.status)),
    nameCell,
    h("td", { text: budget }),
    h("td", {}, h("b", { text: fmt.int(results) }), " ", prevResults != null ? deltaBadge(results, prevResults) : null),
    h("td", {}, cprCell(agg, def)),
    h("td", { text: fmt.int(agg.impressions) }),
    h("td", { text: fmt.int(agg.reach) }),
    h("td", { text: fmt.brl(agg.cpm) }),
    h("td", { text: fmt.pct(agg.ctr) }),
    h("td", { text: fmt.int(agg.clicks) }),
    h("td", { text: fmt.brl(agg.cpc) }),
    h("td", { text: fmt.brl(agg.spend) }),
    h("td", { class: "act-cell" }, h("div", { class: "act" }, badge(as.level, as.level === "ok" ? "na meta" : as.level === "warn" ? "atenção" : as.level === "crit" ? "crítico" : "sem meta"), h("span", { text: as.text }))),
  );
}

/* ====================================================== seção: criativos */
function renderCreatives() {
  const sec = $("#sec-criativos"); sec.replaceChildren();
  const m = state.meta;
  const rows = rowsIn(state.since, state.until);
  const byAd = groupBy(rows, "ad_id");
  let items = m.ads.map((ad) => ({ ad, agg: byAd.get(ad.id) || finish(emptyAgg()), def: resultDefFor(ad.campaign_id), camp: idx.campaigns.get(ad.campaign_id), set: idx.adsets.get(ad.adset_id) }))
    .map((x) => ({ ...x, as: assess(x.agg, x.def) }))
    .filter((x) => x.agg.spend > 0 || x.ad.effective_status === "ACTIVE");
  const f = state.creativeFilter;
  const campaignsWithAds = m.campaigns.filter((c) => items.some((x) => x.ad.campaign_id === c.id));
  if (f.campaign !== "all") items = items.filter((x) => x.ad.campaign_id === f.campaign);
  if (f.quality !== "all") items = items.filter((x) => x.as.level === f.quality);
  items.sort((a, b) => b.agg.spend - a.agg.spend);

  const sel = h("select", { onchange: (e) => { state.creativeFilter.campaign = e.target.value; renderCreatives(); } }, h("option", { value: "all", text: "Todas as campanhas" }), ...campaignsWithAds.map((c) => h("option", { value: c.id, text: c.name, selected: f.campaign === c.id ? "" : null })));
  const chips = ["all", "ok", "warn", "crit"].map((q) => h("button", { type: "button", class: `chip${f.quality === q ? " on" : ""}`, text: q === "all" ? "Todos" : q === "ok" ? "● Na meta" : q === "warn" ? "▲ Atenção" : "■ Crítico", onclick: () => { state.creativeFilter.quality = q; renderCreatives(); } }));
  const filters = h("div", { class: "filter-row" }, h("span", { text: "Campanha" }), sel, h("span", { text: "Qualidade" }), ...chips, h("span", { class: "faint", text: `${items.length} criativos · ${fmt.brl(sum(items, (x) => x.agg.spend))} investido` }));

  const cards = h("div", { class: "cards" }, ...items.map((x) => {
    const thumb = thumbOf(x.ad), link = adLink(x.ad);
    const r = resultsOf(x.agg, x.def), cpr = costPerResult(x.agg, x.def);
    return h("div", { class: `creative ${x.as.level}` },
      h("div", { class: "img" }, thumb ? h("img", { src: thumb, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null, link ? h("a", { href: link, target: "_blank", rel: "noopener noreferrer", text: "abrir ↗" }) : null),
      h("div", { class: "body" },
        h("div", { class: "badges" }, statusBadge(x.ad.effective_status, x.ad.status), badge(x.as.level, x.as.level === "ok" ? "na meta" : x.as.level === "warn" ? "atenção" : x.as.level === "crit" ? "crítico" : "sem meta"), x.ad.creative?.object_type ? h("span", { class: "badge neutral", text: x.ad.creative.object_type.toLowerCase().replace("_", " ") }) : null),
        h("div", { class: "n", text: x.ad.name }),
        h("div", { class: "s", text: `${x.camp?.name || ""} · ${x.set?.name || ""}` }),
        h("div", { class: "m" }, h("span", {}, h("b", { text: fmt.brl(x.agg.spend) }), " gasto"), h("span", {}, h("b", { text: fmt.int(r) }), ` ${x.def.unit}${r === 1 ? "" : "s"}`), h("span", {}, h("b", { text: ok(cpr) ? (x.def.per ? fmt.brl(cpr) + "/mil" : fmt.brl(cpr)) : "—" }), ` por ${x.def.unit}`)),
        h("div", { class: "m" }, h("span", {}, h("b", { text: fmt.pct(x.agg.ctr) }), " CTR"), h("span", {}, h("b", { text: fmt.brl(x.agg.cpm) }), " CPM"), h("span", {}, h("b", { text: fmt.int(x.agg.link_clicks) }), " cliques"), x.agg.thruplays ? h("span", {}, h("b", { text: fmt.int(x.agg.thruplays) }), " thruplays") : null),
        x.ad.creative?.body ? h("div", { class: "copy", text: x.ad.creative.body }) : null,
      ),
    );
  }));
  sec.append(block("Criativos com entrega", "clique em “abrir” para ver o anúncio publicado", filters, items.length ? cards : h("div", { class: "empty", text: "Nenhum criativo para este filtro." })));
}

/* ======================================================= seção: orgânico */
function seriesLast(arr, days) { if (!arr?.length) return []; const cut = addDays(state.meta.range.until, -(days - 1)); return arr.filter((p) => p.date >= cut); }
function renderOrganic() {
  const sec = $("#sec-organico"); sec.replaceChildren();
  const o = state.organic;
  if (!o) { sec.append(block("Orgânico", "Instagram e Facebook", h("div", { class: "placeholder" }, h("b", { text: "Dados orgânicos ainda não coletados" }), h("span", { text: "O coletor gera organic.json quando o token tiver as permissões pages_read_engagement, read_insights, instagram_basic e instagram_manage_insights." })))); return; }
  const ig = o.instagram, fb = o.facebook;
  if (o.warnings?.length) sec.append(h("div", { class: "banner" }, h("b", { text: "Avisos da coleta orgânica: " }), h("ul", {}, ...o.warnings.slice(0, 8).map((w) => h("li", { text: w })))));

  if (ig) {
    const reach30 = seriesLast(ig.daily?.reach, 30), reachPrev = ig.daily?.reach ? ig.daily.reach.filter((p) => p.date < addDays(state.meta.range.until, -29) && p.date >= addDays(state.meta.range.until, -59)) : [];
    const foll30 = seriesLast(ig.daily?.follower_count, 30);
    const t30 = ig.totals?.last_30d || {}, t7 = ig.totals?.last_7d || {};
    const pv30 = seriesLast(ig.daily?.profile_views, 30), ae30 = seriesLast(ig.daily?.accounts_engaged, 30);
    const tiles = h("div", { class: "grid c6" },
      tile({ label: "Seguidores", value: fmt.int(ig.followers), sub: `${fmt.int(ig.media_count)} publicações · segue ${fmt.int(ig.follows)}`, accent: true }),
      tile({ label: "Novos seguidores (30d)", value: foll30.length ? "+" + fmt.int(sum(foll30, (p) => p.value)) : "—", sub: foll30.length ? `${fmt.dec1(sum(foll30, (p) => p.value) / foll30.length)} por dia` : "série indisponível" }),
      tile({ label: "Alcance (30d)", value: reach30.length ? fmt.int(sum(reach30, (p) => p.value)) : "—", delta: reachPrev.length ? deltaBadge(sum(reach30, (p) => p.value), sum(reachPrev, (p) => p.value)) : null, sub: "soma do alcance diário" }),
      tile({ label: "Visitas ao perfil (30d)", value: fmt.int(t30.profile_views ?? (pv30.length ? sum(pv30, (p) => p.value) : null)), sub: `7d: ${fmt.int(t7.profile_views)}` }),
      tile({ label: "Contas engajadas (30d)", value: fmt.int(t30.accounts_engaged ?? (ae30.length ? sum(ae30, (p) => p.value) : null)), sub: `interações: ${fmt.int(t30.total_interactions)}` }),
      tile({ label: "Visualizações (30d)", value: fmt.int(t30.views), sub: `cliques no site: ${fmt.int(t30.website_clicks)}` }),
    );
    const charts = h("div", { class: "grid c2" });
    if (reach30.length) charts.append(chartCard("Alcance diário · Instagram", "últimos 30 dias (orgânico + pago)", [{ name: "Alcance", color: "#d55181", values: reach30.map((p) => p.value) }], { labels: reach30.map((p) => fmt.dm(p.date)), type: "bar" }));
    if (foll30.length) charts.append(chartCard("Novos seguidores por dia", "últimos 30 dias", [{ name: "Seguidores", color: "#199e70", values: foll30.map((p) => p.value) }], { labels: foll30.map((p) => fmt.dm(p.date)), type: "bar" }));
    if (pv30.length) charts.append(chartCard("Visitas ao perfil por dia", "últimos 30 dias", [{ name: "Visitas", color: "#3987e5", values: pv30.map((p) => p.value) }], { labels: pv30.map((p) => fmt.dm(p.date)), type: "bar" }));
    if (ae30.length) charts.append(chartCard("Contas engajadas por dia", "últimos 30 dias", [{ name: "Contas", color: "#c98500", values: ae30.map((p) => p.value) }], { labels: ae30.map((p) => fmt.dm(p.date)), type: "bar" }));

    const medias = (ig.media || []).map((x) => { const i = x.insights || {}; const inter = (x.likes || 0) + (x.comments || 0) + (i.saved || 0) + (i.shares || 0); return { ...x, inter, reach: i.reach || 0, rate: i.reach ? (inter / i.reach) * 100 : null }; }).sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    const grid = h("div", { class: "media-grid" }, ...medias.slice(0, 24).map((x) => h("div", { class: "media" },
      h("a", { href: x.permalink, target: "_blank", rel: "noopener noreferrer" }, h("div", { class: "pic" }, x.thumbnail ? h("img", { src: x.thumbnail, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null, h("span", { class: "type", text: (x.product_type || x.media_type || "").toLowerCase() }))),
      h("div", { class: "info" }, h("div", { class: "d", text: fmt.date((x.timestamp || "").slice(0, 10)) }),
        h("div", { class: "k" }, h("span", { text: "Alcance" }), h("b", { text: fmt.int(x.reach || null) })),
        h("div", { class: "k" }, h("span", { text: "Curtidas · coment." }), h("b", { text: `${fmt.int(x.likes)} · ${fmt.int(x.comments)}` })),
        h("div", { class: "k" }, h("span", { text: "Salvos · compart." }), h("b", { text: `${fmt.int(x.insights?.saved ?? null)} · ${fmt.int(x.insights?.shares ?? null)}` })),
        h("div", { class: "k" }, h("span", { text: "Engajamento" }), h("b", { text: ok(x.rate) ? fmt.pct(x.rate) : "—" })),
      ))));
    const top = medias.filter((x) => x.reach > 0).sort((a, b) => b.reach - a.reach).slice(0, 5);
    const topList = top.length ? h("div", { class: "card" }, h("h3", { text: "Publicações com maior alcance" }), h("div", { class: "list" }, ...top.map((x, i) => h("div", { class: "list-item" }, h("span", { class: "rank good", text: i + 1 }), x.thumbnail ? h("img", { class: "thumb", src: x.thumbnail, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null, h("div", { class: "txt" }, h("div", { class: "n" }, h("a", { href: x.permalink, target: "_blank", rel: "noopener noreferrer", text: x.caption ? x.caption.slice(0, 80) : (x.product_type || "publicação") })), h("div", { class: "s", text: `${fmt.date((x.timestamp || "").slice(0, 10))} · alcance ${fmt.int(x.reach)} · ${fmt.int(x.inter)} interações · ${ok(x.rate) ? fmt.pct(x.rate) : "—"} engaj.` })))))) : null;

    sec.append(block("Instagram", `@${ig.username}`, h("div", { class: "card profile" }, ig.profile_picture_url ? h("img", { src: ig.profile_picture_url, alt: "", referrerpolicy: "no-referrer" }) : null, h("div", {}, h("div", { class: "n", text: ig.name || ig.username }), h("div", { class: "s", text: ig.biography || "" }))), tiles, charts, topList, block("Publicações recentes", "métricas por publicação (Instagram Insights)", medias.length ? grid : h("div", { class: "empty", text: "Sem publicações coletadas." }))));
  } else {
    sec.append(block("Instagram", "", h("div", { class: "placeholder" }, h("b", { text: "Instagram indisponível" }), h("span", { text: "Verifique as permissões instagram_basic e instagram_manage_insights do token e se o perfil está vinculado à página." }))));
  }

  if (fb) {
    const d = fb.daily || {};
    const imp30 = seriesLast(d.page_impressions_unique, 30), eng30 = seriesLast(d.page_post_engagements, 30), fol30 = seriesLast(d.page_daily_follows_total, 30), views30 = seriesLast(d.page_views_total, 30);
    const tiles = h("div", { class: "grid c4" },
      tile({ label: "Seguidores da página", value: fmt.int(fb.followers ?? fb.fans), sub: `${fmt.int(fb.fans)} curtidas` }),
      tile({ label: "Alcance (30d)", value: imp30.length ? fmt.int(sum(imp30, (p) => p.value)) : "—", sub: "soma do alcance diário" }),
      tile({ label: "Engajamentos (30d)", value: eng30.length ? fmt.int(sum(eng30, (p) => p.value)) : "—", sub: `${views30.length ? fmt.int(sum(views30, (p) => p.value)) : "—"} visitas à página` }),
      tile({ label: "Novos seguidores (30d)", value: fol30.length ? "+" + fmt.int(sum(fol30, (p) => p.value)) : "—", sub: "" }),
    );
    const charts = h("div", { class: "grid c2" });
    if (imp30.length) charts.append(chartCard("Alcance diário · Facebook", "últimos 30 dias", [{ name: "Alcance", color: "#3987e5", values: imp30.map((p) => p.value) }], { labels: imp30.map((p) => fmt.dm(p.date)), type: "bar" }));
    if (eng30.length) charts.append(chartCard("Engajamentos por dia · Facebook", "últimos 30 dias", [{ name: "Engajamentos", color: "#199e70", values: eng30.map((p) => p.value) }], { labels: eng30.map((p) => fmt.dm(p.date)), type: "bar" }));
    const posts = (fb.posts || []).slice(0, 10);
    const list = posts.length ? h("div", { class: "card" }, h("h3", { text: "Publicações recentes da página" }), h("div", { class: "list" }, ...posts.map((p) => h("div", { class: "list-item" }, p.picture ? h("img", { class: "thumb", src: p.picture, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null, h("div", { class: "txt" }, h("div", { class: "n" }, h("a", { href: p.permalink, target: "_blank", rel: "noopener noreferrer", text: p.message ? p.message.slice(0, 90) : "publicação" })), h("div", { class: "s", text: `${fmt.date((p.created_time || "").slice(0, 10))} · ${fmt.int(p.likes)} curtidas · ${fmt.int(p.comments)} comentários · ${fmt.int(p.shares)} compart.` })))))) : null;
    sec.append(block("Facebook", fb.name || "", tiles, charts, list));
  }
}

/* ========================================================= seção: google */
function renderGoogle() {
  const sec = $("#sec-google"); sec.replaceChildren();
  const g = state.config.google_ads || {};
  sec.append(block("Google Ads", "", h("div", { class: "placeholder" }, h("b", { text: g.enabled ? "Integração pendente" : "Google Ads ainda não está ativo para a Lapidation" }), h("span", { text: g.note || "" }), h("span", { class: "faint", text: `Verba prevista: ${fmt.brl(state.config.budget.google_monthly)}/mês. Quando a conta for criada no MCC, esta seção passa a mostrar campanhas, grupos de anúncios, ligações e custo por ligação.` }))));
}

/* ======================================================== seção: legendas */
function renderLegend() {
  const sec = $("#sec-legendas"); sec.replaceChildren();
  const T = state.targets;
  const dl = (pairs) => h("dl", { class: "dl" }, ...pairs.flatMap(([k, v]) => [h("dt", { text: k }), h("dd", { text: v })]));
  sec.append(
    block("Métricas", "", h("div", { class: "card" }, dl([
      ["Conversas iniciadas", "Pessoas que abriram uma conversa no WhatsApp a partir do anúncio (atribuição de 7 dias após o clique). É o “lead” da Lapidation."],
      ["Custo por conversa", "Gasto das campanhas de captação ÷ conversas iniciadas. Meta atual: " + fmt.brl(T.cost_per_conversation) + "."],
      ["Captação vs. topo de funil", "Captação = campanhas de conversa/cadastro/venda. Topo = alcance, reconhecimento, visitas ao perfil e engajamento. O custo por conversa usa só a captação."],
      ["Visitas ao perfil", "Resultado da campanha de tráfego para o Instagram. A API não expõe esse número diretamente; usamos cliques no link como proxy quando necessário."],
      ["Alcance", "Contas únicas que viram o anúncio. Não soma entre dias — os atalhos de período usam o valor exato da API; períodos personalizados somam o alcance diário (aproximação)."],
      ["Frequência", "Impressões ÷ alcance. Acima de " + fmt.dec1(T.frequency_max) + " indica saturação do público."],
      ["CPM", "Custo por mil impressões. Para campanhas de topo de funil a meta é até " + fmt.brl(T.cpm_topo_max) + "."],
      ["CTR", "Cliques (todos) ÷ impressões. Abaixo de " + fmt.pct(T.ctr_min) + " sugere criativo pouco atrativo."],
      ["CPC", "Custo por clique (todos os cliques)."],
      ["ThruPlay", "Reproduções de vídeo de 15 s ou até o fim (quando menor)."],
    ]))),
    block("Status e qualidade", "", h("div", { class: "card" }, dl([
      ["● Na meta", "Custo por resultado igual ou abaixo da meta — manter."],
      ["▲ Atenção", "Custo até 1,6× a meta, ou sem resultado com gasto baixo — otimizar segmentação/criativo ou observar."],
      ["■ Crítico", "Custo acima de 1,6× a meta, ou gasto ≥ " + fmt.brl(T.min_spend_for_alert) + " sem nenhum resultado — reduzir verba, pausar ou revisar."],
      ["Ativo / Pausado / Com problema", "Status efetivo de entrega informado pela Meta (considera campanha, conjunto, análise e cobrança)."],
      ["Período anterior", "Todas as variações (↑ ↓) comparam com o período imediatamente anterior de mesma duração."],
    ]))),
    block("Fontes e atualização", "", h("div", { class: "card" }, dl([
      ["Meta Ads", `Marketing API ${state.meta.api_version} · conta ${state.meta.account.id} · série diária por anúncio desde ${fmt.date(state.meta.range.since)}.`],
      ["Orgânico", "Graph API: Página do Facebook e Instagram Business. Séries dos últimos 30/90 dias; métricas por publicação via Instagram Insights."],
      ["Atualização", "Automática todo dia às 7h (Brasília) via GitHub Actions, com publicação no Cloudflare Pages. Última coleta: " + fmt.dateTime(state.meta.generated_at) + "."],
      ["Metas", "Editáveis no menu lateral (ficam salvas apenas neste navegador). Padrão definido em config.json."],
    ]))),
  );
}

/* ================================================================ header */
function renderHeader() {
  const c = state.config.client;
  $("#brand-name").textContent = c.name; $("#brand-sub").textContent = `B2C · ${c.agency || "Performance"}`; $("#brand-market").textContent = c.market;
  $("#topbar-sub").textContent = `${c.segment} · Meta Ads e orgânico`;
  $("#hdr-period").textContent = `${fmt.date(state.since)} — ${fmt.date(state.until)}`;
  $("#hdr-compare").textContent = `${fmt.date(state.prevSince)} — ${fmt.date(state.prevUntil)}`;
  $("#hdr-updated").textContent = fmt.dateTime(state.meta.generated_at);
  $("#f-note").textContent = `Dados disponíveis de ${fmt.date(state.meta.range.since)} a ${fmt.date(state.meta.range.until)}`;
  $("#f-since").value = state.since; $("#f-until").value = state.until;
  $("#f-since").min = state.meta.range.since; $("#f-until").max = state.meta.range.until;
  $("#t-conv").textContent = fmt.brl(state.targets.cost_per_conversation);
  $("#t-visit").textContent = fmt.brl(state.targets.cost_per_profile_visit);
  $("#t-budget").textContent = fmt.brl(state.targets.meta_monthly);
  const warnings = state.meta.warnings || [];
  const banner = $("#banner");
  if (warnings.length) { banner.hidden = false; banner.replaceChildren(h("b", { text: "Avisos da última coleta:" }), h("ul", {}, ...warnings.slice(0, 6).map((w) => h("li", { text: w })))); } else banner.hidden = true;
}

function renderAll() {
  computePeriod();
  renderHeader();
  renderExec(); renderMeta(); renderCreatives(); renderOrganic(); renderGoogle(); renderLegend();
  showSection(state.section);
}
function showSection(name) {
  state.section = name;
  for (const s of $$(".section")) s.hidden = s.id !== `sec-${name}`;
  for (const a of $$(".nav-item")) a.classList.toggle("active", a.dataset.section === name);
  // gráficos precisam de largura real para renderizar
  requestAnimationFrame(() => $$(".chart-card").forEach((c) => c._render && c._render()));
  window.scrollTo({ top: 0 });
}

/* ================================================================== boot */
async function fetchJson(url, { optional = false } = {}) {
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (res.status === 401) { location.href = "/login"; throw new Error("sessão expirada"); }
  if (!res.ok) { if (optional) return null; throw new Error(`${url}: HTTP ${res.status}`); }
  return res.json();
}
async function boot() {
  tooltipEl = $("#tooltip");
  try {
    state.config = await fetchJson("/config.json");
    state.meta = await fetchJson("/data/meta.json", { optional: true });
    state.organic = await fetchJson("/data/organic.json", { optional: true });
  } catch (e) {
    $("#banner").hidden = false; $("#banner").classList.add("error"); $("#banner").textContent = `Falha ao carregar dados: ${e.message}`;
    return;
  }
  if (!state.meta) {
    $("#banner").hidden = false; $("#banner").classList.add("error");
    $("#banner").textContent = "Ainda não há dados coletados (public/data/meta.json). Rode o workflow “Atualizar dashboard” no GitHub Actions ou `python scripts/fetch_meta.py` com META_ACCESS_TOKEN.";
    return;
  }
  state.targets = loadTargets();
  buildIndexes();
  const span = daysBetween(state.meta.range.since, state.meta.range.until);
  state.preset = span <= 45 ? "max" : "30";
  $("#f-preset").value = state.preset;
  const hash = location.hash.replace("#", "");
  if (["exec", "meta", "criativos", "organico", "google", "legendas"].includes(hash)) state.section = hash;

  $("#f-preset").addEventListener("change", (e) => { state.preset = e.target.value; if (state.preset !== "custom") renderAll(); });
  $("#f-apply").addEventListener("click", () => {
    const s = $("#f-since").value, u = $("#f-until").value;
    if (s && u && s <= u) { state.preset = "custom"; $("#f-preset").value = "custom"; state.since = s; state.until = u; renderAll(); }
  });
  for (const inp of ["#f-since", "#f-until"]) $(inp).addEventListener("change", () => { $("#f-preset").value = "custom"; state.preset = "custom"; });
  window.addEventListener("hashchange", () => { const hsh = location.hash.replace("#", ""); if ($(`#sec-${hsh}`)) showSection(hsh); });
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => $$(".chart-card").forEach((c) => c._render && c._render()), 150); });

  const form = $("#targets-form");
  $("#btn-edit-targets").addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) for (const k of ["cost_per_conversation", "cost_per_profile_visit", "meta_monthly", "frequency_max"]) form.elements[k].value = state.targets[k];
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = { ...state.targets };
    for (const k of ["cost_per_conversation", "cost_per_profile_visit", "meta_monthly", "frequency_max"]) { const v = parseFloat(form.elements[k].value); if (ok(v) && v > 0) t[k] = v; }
    state.targets = t; saveTargets(t); form.hidden = true; renderAll();
  });
  $("#btn-reset-targets").addEventListener("click", () => { try { localStorage.removeItem("lapidation.targets"); } catch { /* ignore */ } state.targets = loadTargets(); form.hidden = true; renderAll(); });

  renderAll();
}
document.addEventListener("DOMContentLoaded", boot);
