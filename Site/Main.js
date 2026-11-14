import { Globe, escapeHtml as esc } from './Scripts/Javascript/Globe.js';
import { rankSites, scoreColor, pct } from './Scripts/Javascript/Scoring.js';

const TEXTURES = {
  moon: 'Assets/Textures/moon.jpg',
  mars: 'Assets/Textures/mars.jpg',
  earth: 'Assets/Textures/earth.jpg',
};
const BODY_NAME = { moon: 'Moon', mars: 'Mars' };
const RANK_SIZE = 8;
const $ = (id) => document.getElementById(id);

const state = {
  body: 'moon',
  targetId: null,
  siteId: null,
  profileId: 'general',
  weights: {},
  enabled: {},
};
let cfg, sites, bodyGlobe, earthGlobe;

init().catch((err) => {
  console.error(err);
  $('stage').insertAdjacentHTML('beforeend', `<div class="loading">Could not load data (${esc(err.message)}). Serve the site over http(s), not file://.</div>`);
});

async function init() {
  [cfg, sites] = await Promise.all([fetchJson('data/alvos.json'), fetchJson('data/locais.json')]);
  $('sampleChip').hidden = !sites.some((s) => s.exemplo || s.modo_teste);

  bodyGlobe = new Globe($('bodyGlobe'), { distance: 3.0 });
  earthGlobe = new Globe($('earthGlobe'), { distance: 3.15, atmosphere: '#4aa3ff', minDistance: 1.4 });
  earthGlobe.setTexture(TEXTURES.earth);

  bodyGlobe.onPick = (id) => selectTarget(id);
  bodyGlobe.onHover = (ll) => {
    $('hoverCoords').textContent = ll ? `lat ${ll.lat.toFixed(1)}°, lon ${ll.lon.toFixed(1)}°` : 'lat –, lon –';
  };
  earthGlobe.onPick = (id) => selectSite(id, { fly: true });

  $('zoomIn').onclick = () => bodyGlobe.zoom(0.8);
  $('zoomOut').onclick = () => bodyGlobe.zoom(1.25);
  $('resetView').onclick = () => {
    const t = target();
    t ? bodyGlobe.flyTo(t.lat, t.lon, bodyGlobe.homeDistance) : bodyGlobe.resetView();
  };
  $('aboutBtn').onclick = () => $('about').showModal();
  document.querySelectorAll('.bodyswitch button').forEach((b) => { b.onclick = () => setBody(b.dataset.body); });

  buildProfileControls();

  // Deep link: #moon/shackleton/vargeao
  const [hb, ht, hs] = location.hash.replace('#', '').split('/');
  const body = BODY_NAME[hb] ? hb : 'moon';
  setBody(body, { targetId: cfg.alvos.some((a) => a.id === ht && a.corpo === body) ? ht : null, siteId: hs });
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const target = () => cfg.alvos.find((a) => a.id === state.targetId);
const site = () => sites.find((s) => s.id === state.siteId);

/* ---------------- body + targets ---------------- */

function setBody(body, { targetId = null, siteId = null } = {}) {
  state.body = body;
  document.querySelectorAll('.bodyswitch button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.body === body)));
  $('crumbBody').textContent = BODY_NAME[body];
  const targets = cfg.alvos.filter((a) => a.corpo === body);
  $('bodyChip').textContent = `${BODY_NAME[body]} · ${targets.length} targets`;

  bodyGlobe.setTexture(TEXTURES[body]);
  bodyGlobe.setMarkers(targets.map((t) => ({
    id: t.id, lat: t.lat, lon: t.lon, label: t.nome, color: '#3b8cff', size: 1, showLabel: true,
  })));

  $('targetList').innerHTML = targets.map((t) => `
    <li><button data-id="${t.id}" aria-pressed="false">${esc(t.nome)}<small>${esc(t.regiao)}</small></button></li>`).join('');
  $('targetList').querySelectorAll('button').forEach((b) => { b.onclick = () => selectTarget(b.dataset.id); });

  selectTarget(targetId || targets[0].id, { siteId });
}

function selectTarget(id, { siteId = null } = {}) {
  const t = cfg.alvos.find((a) => a.id === id);
  if (!t) return;
  state.targetId = id;
  bodyGlobe.setActive(id);
  bodyGlobe.flyTo(t.lat, t.lon);
  $('targetList').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  $('crumbTarget').textContent = t.nome;
  $('rankTarget').textContent = t.nome;
  renderTargetCard(t);
  refreshRanking({ keepSite: siteId });
}

function renderTargetCard(t) {
  const kv = Object.entries(t.indicadores || {}).map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join('');
  const card = $('targetCard');
  card.innerHTML = `<h3>${esc(t.nome)}</h3><p>${esc(t.resumo)}</p><div class="kv">${kv}</div>`;
  card.hidden = false;
}

/* ---------------- profile + dimensions ---------------- */

function buildProfileControls() {
  const sel = $('profileSelect');
  sel.innerHTML = cfg.perfis.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  sel.onchange = () => applyProfile(sel.value);

  $('dimList').innerHTML = cfg.dimensoes.map((d) => `
    <li><label><input type="checkbox" data-dim="${d.id}" checked> ${esc(d.label)} <span class="w" data-w="${d.id}"></span></label></li>`).join('');
  $('dimList').querySelectorAll('input').forEach((inp) => {
    inp.onchange = () => { state.enabled[inp.dataset.dim] = inp.checked; refreshRanking({ keepSite: state.siteId }); };
  });
  cfg.dimensoes.forEach((d) => { state.enabled[d.id] = true; });
  applyProfile('general', false);
}

function applyProfile(id, refresh = true) {
  const p = cfg.perfis.find((x) => x.id === id) || cfg.perfis[0];
  state.profileId = p.id;
  state.weights = { ...p.pesos };
  cfg.dimensoes.forEach((d) => {
    const w = state.weights[d.id] ?? 0;
    document.querySelector(`[data-w="${d.id}"]`).textContent = w ? `×${w}` : 'off';
  });
  if (refresh) refreshRanking({ keepSite: state.siteId });
}

function effectiveWeights() {
  const w = {};
  for (const d of cfg.dimensoes) w[d.id] = state.enabled[d.id] ? (state.weights[d.id] ?? 0) : 0;
  return w;
}

/* ---------------- ranking + Earth globe ---------------- */

function refreshRanking({ keepSite = null } = {}) {
  const ranked = rankSites(sites, state.targetId, effectiveWeights());
  state.ranked = ranked;

  const topIds = new Set(ranked.slice(0, 3).map((r) => r.site.id));
  earthGlobe.setMarkers(ranked.map((r) => ({
    id: r.site.id, lat: r.site.lat, lon: r.site.lon,
    color: scoreColor(r.score), size: 0.7 + r.score * 0.6, small: true,
    showLabel: topIds.has(r.site.id),
    labelHtml: `${esc(shortName(r.site))}<span class="s">${pct(r.score)}</span>`,
  })));

  $('ranking').innerHTML = ranked.slice(0, RANK_SIZE).map((r, i) => `
    <li><button data-id="${r.site.id}" aria-pressed="false">
      <span class="pos">${i + 1}</span>
      <span class="name"><b>${esc(r.site.nome)}</b><small>${esc(r.site.regiao)} ${roleChip(r.site)}</small></span>
      <span class="score" style="color:${scoreColor(r.score)}">${pct(r.score)}</span>
    </button></li>`).join('');
  $('ranking').querySelectorAll('button').forEach((b) => { b.onclick = () => selectSite(b.dataset.id, { fly: true }); });

  const keep = keepSite && ranked.some((r) => r.site.id === keepSite);
  selectSite(keep ? keepSite : ranked[0]?.site.id, { fly: true });
}

function selectSite(id, { fly = false } = {}) {
  const r = state.ranked.find((x) => x.site.id === id);
  if (!r) return;
  state.siteId = id;
  earthGlobe.setActive(id);
  if (fly) earthGlobe.flyTo(r.site.lat, r.site.lon);
  $('ranking').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  const rank = state.ranked.indexOf(r) + 1;
  $('earthLabel').textContent = `#${rank} ${r.site.nome} · ${r.site.lat.toFixed(2)}°, ${r.site.lon.toFixed(2)}°`;
  renderAnalogCard(r, rank);
  history.replaceState(null, '', `#${state.body}/${state.targetId}/${id}`);
}

function shortName(s) {
  return s.nome.replace(/^(Domo de|Cratera de|Serra Norte de)\s+/i, '').replace(/\s*\(.*\)$/, '');
}

function roleChip(s) {
  if (s.papel === 'referência' || s.papel === 'referencia') return '<span class="chip ref">Validation · classic</span>';
  if (/\bBR$/.test(s.regiao)) return '<span class="chip br">New · BR</span>';
  return '<span class="chip br">New</span>';
}

/* ---------------- analog card ---------------- */

function renderAnalogCard({ site: s, score }, rank) {
  const t = target();
  const w = effectiveWeights();
  const dims = s.notas?.[t.id] || {};
  const bars = cfg.dimensoes.map((d) => {
    const v = dims[d.id];
    const on = w[d.id] > 0;
    if (typeof v !== 'number') return '';
    return `<li class="${on ? '' : 'off'}"><span>${esc(d.label)}${on ? '' : ' (off)'}</span>
      <span class="track"><span class="fill" style="width:${v * 100}%;background:${scoreColor(v)}"></span></span>
      <span class="v">${pct(v)}</span></li>`;
  }).join('');

  const a = s.analogia?.[t.id] || s.analogia?.[t.corpo] || {};
  const works = (a.works || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="always">No notes yet.</li>';
  const breaks = (a.breaks || []).map((x) => `<li>${esc(x)}</li>`).join('');
  const always = cfg.sempre_quebra.map((x) => `<li class="always">${esc(x)}</li>`).join('');

  const facts = [
    ['Type', s.tipo_en || s.tipo],
    ['Elevation', num(s.elev_media_m, ' m')],
    ['Mean slope', num(s.declividade_media, '°', 1)],
    ['Drivable (<15°)', s.frac_transitavel_15 != null ? pct(s.frac_transitavel_15) : null],
    ['Air temp.', num(s.t2m_c, ' °C', 1)],
    ['Rain', num(s.chuva_anual_mm, ' mm/yr')],
    ['NDVI', num(s.ndvi_medio, '', 2)],
    ['Dominant mineral (EMIT)', s.emit_mineral_dominante],
  ].filter(([, v]) => v != null && v !== '').map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join('');

  const C = 2 * Math.PI * 52;
  const card = $('analogCard');
  card.hidden = false;
  card.innerHTML = `
    <div class="card-title">
      <h2>#${rank} ${esc(s.nome)}</h2>
      <span class="vs">${esc(s.regiao)} ↔ ${esc(t.nome)} (${BODY_NAME[t.corpo]})</span>
      ${roleChip(s)}
    </div>
    <div class="card-grid">
      <div class="ring">
        <svg viewBox="0 0 120 120" role="img" aria-label="Similarity ${pct(score)}">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#1b2a42" stroke-width="10"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="${scoreColor(score)}" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${C * score} ${C}" transform="rotate(-90 60 60)"/>
          <text x="60" y="68" text-anchor="middle" font-size="26" font-weight="700" fill="currentColor">${pct(score)}</text>
        </svg>
        <div class="lbl">Analog index · ${esc(cfg.perfis.find((p) => p.id === state.profileId).label)}</div>
      </div>
      <div>
        <h3>Similarity by dimension</h3>
        <ul class="bars">${bars}</ul>
      </div>
      <div class="wb works"><h3>✓ Where it works</h3><ul>${works}</ul></div>
      <div class="wb breaks"><h3>✗ Where it breaks</h3><ul>${breaks}${always}</ul></div>
    </div>
    <div class="facts">${facts}</div>
    <div class="facts">Data for ${esc(t.nome)}: ${esc((t.fontes || []).join(' · '))}</div>`;
}

function num(v, unit = '', d = 0) {
  return typeof v === 'number' ? `${v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}${unit}` : null;
}
