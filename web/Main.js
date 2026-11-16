import { Globe, escapeHtml as esc } from './Scripts/Javascript/Globe.js';
import { rankSites, scoreColor, pct } from './Scripts/Javascript/Scoring.js';
import { Station } from './Scripts/Javascript/Station.js';

// Moon: NASA SVS CGI Moon Kit (LRO LROC colour mosaic) with relief from LRO LOLA (LDEM 16 ppd).
// Mars: NASA 3D Resources Mars colour map (Viking/MGS) with its normal map.
const BIG_TEX = !matchMedia('(max-width: 820px)').matches;
const TEXTURES = {
  moon: BIG_TEX ? 'Assets/Textures/moon_8k.jpg' : 'Assets/Textures/moon_4k.jpg',
  moonBump: 'Assets/Textures/moon_bump.jpg',
  mars: 'Assets/Textures/mars_4k.jpg',
  marsNormal: 'Assets/Textures/mars_normal_4k.jpg',
  earth: 'Assets/Textures/earth.jpg',
  earthRelief: 'Assets/Textures/earth_srtm30.jpg',
  earthReliefBump: 'Assets/Textures/earth_bump_srtm30.jpg',
};
// NASA SRTM30 (SRTMGL30) averaged to a 0.25° grid: int16 LE, row 0 = 90°N, col 0 = 180°W
const ELEV = { url: 'data/elevacao_srtm30_025.bin', res: 0.25, w: 1440, h: 720, ocean: -9999, nodata: -32768 };
let elevGrid = null;
const BODY = {
  moon: { name: 'Moon', radiusKm: 1737.4, tex: { bump: 0.012, bumpUrl: 'moonBump' } },
  mars: { name: 'Mars', radiusKm: 3389.5, tex: { normalUrl: 'marsNormal', normalScale: 0.9 } },
};
const TOP_CHIPS = matchMedia('(max-width: 820px)').matches ? 2 : 3;
const ALWAYS_SHORT = ['1 g gravity', 'Thick atmosphere', 'Radiation shield'];
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = matchMedia('(max-width: 820px)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const state = { body: 'moon', targetId: null, siteId: null, profileId: 'general', weights: {}, ranked: [] };
let cfg, sites, bodyGlobe, earthGlobe, stCfg, station;

init().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<div class="intro"><div class="intro-card"><h2>Could not load data</h2><p>${esc(err.message)}. Serve the site over http(s), not file://.</p></div></div>`);
});

async function init() {
  [cfg, sites, stCfg] = await Promise.all([fetchJson('data/alvos.json'), fetchJson('data/locais.json'), fetchJson('data/estacao.json')]);
  $('sampleChip').hidden = !sites.some((s) => s.exemplo || s.modo_teste);

  bodyGlobe = new Globe($('bodyGlobe'), { zoom: phone ? 0.68 : 0.86, idleSpin: 0.0006, minDistance: 1.2, radiusKm: 1737.4, name: 'Moon' });
  if (bodyGlobe.renderer.capabilities.maxTextureSize < 8192) TEXTURES.moon = 'Assets/Textures/moon_4k.jpg';
  earthGlobe = new Globe($('earthGlobe'), { offsetX: phone ? 0.17 : 0, zoom: phone ? 0.9 * 0.66 / (1 - 2 * 0.17) : 0.8, idleSpin: 0.0004, atmosphere: '#6fb6ff', atmosphereStrength: 0.6, minDistance: 1.22, radiusKm: 6371, name: 'Earth' });
  setEarthLayer(store.get('earth-layer') === 'relief' ? 'relief' : 'satellite');
  document.querySelectorAll('#layerSeg button').forEach((b) => { b.onclick = () => setEarthLayer(b.dataset.layer); });
  loadElevation();
  bodyGlobe.onPick = (id) => selectTarget(id, { focus: true });
  earthGlobe.onPick = (id) => selectSite(id, { focus: true });
  earthGlobe.onFrame = () => { drawLink(); placeCard(earthGlobe, $('earthCard'), state.siteId, phone ? ['left', 'right', 'above', 'below'] : ['right', 'above', 'below', 'left']); };
  bodyGlobe.onFrame = () => placeCard(bodyGlobe, $('bodyCard'), state.targetId, phone ? ['above', 'left', 'right', 'below'] : ['left', 'above', 'below', 'right']);
  bodyGlobe.onHover = (ll) => {
    const el = $('bodyHover');
    el.hidden = !ll;
    if (ll) el.textContent = `${fmtLat(ll.lat, 2)}, ${fmtLon(ll.lon, 2)}`;
  };
  earthGlobe.onHover = (ll) => {
    const el = $('earthHover');
    el.hidden = !ll;
    if (ll) el.textContent = `${fmtLat(ll.lat, 2)}, ${fmtLon(ll.lon, 2)}${elevText(ll.lat, ll.lon, ' · ')}`;
  };

  document.querySelectorAll('.topbar .seg button').forEach((b) => { b.onclick = () => setBody(b.dataset.body); });
  $('detailsBtn').onclick = () => openDrawer('analog');
  $('matchBadge').onclick = () => openDrawer('analog');
  $('drawerClose').onclick = closeDrawer;
  $('scrim').onclick = closeDrawer;
  $('aboutBtn').onclick = () => $('about').showModal();
  $('profileBtn').onclick = (e) => { e.stopPropagation(); toggleProfile(); };
  document.addEventListener('click', (e) => { if (!$('profilePop').hidden && !$('profilePop').contains(e.target)) toggleProfile(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); toggleProfile(false); return; }
    // ← / → walk through the Earth twins in ranking order
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input, textarea, select, [contenteditable]')) {
      const i = state.ranked.findIndex((r) => r.site.id === state.siteId);
      const next = state.ranked[(i + (e.key === 'ArrowRight' ? 1 : -1) + state.ranked.length) % state.ranked.length];
      if (next) { e.preventDefault(); selectSite(next.site.id, { focus: true }); }
    }
  });
  // a pasted link or back/forward changes the hash: follow it
  window.addEventListener('hashchange', () => {
    const [b, t, si] = location.hash.replace('#', '').split('/');
    if (!BODY[b]) return;
    if (b !== state.body) setBody(b, { targetId: t, siteId: si });
    else if (t && t !== state.targetId) selectTarget(t, { siteId: si, focus: true });
    else if (si && si !== state.siteId) selectSite(si, { focus: true });
  });

  buildProfile();
  initStation();
  initRoverGallery();

  const deepLink = location.hash.length > 1;
  const [hb, ht, hs] = location.hash.replace('#', '').split('/');
  const body = BODY[hb] ? hb : 'moon';
  setBody(body, { targetId: cfg.alvos.some((a) => a.id === ht && a.corpo === body) ? ht : null, siteId: hs });

  if (!deepLink && !store.get('intro-seen')) {
    $('intro').hidden = false;
    $('introGo').onclick = () => { $('intro').hidden = true; store.set('intro-seen', '1'); };
  }
}

function setEarthLayer(layer) {
  const relief = layer === 'relief';
  earthGlobe.setTexture(relief ? TEXTURES.earthRelief : TEXTURES.earth,
    relief ? { bump: 0.03, bumpUrl: TEXTURES.earthReliefBump } : { bump: 0.01 });
  document.querySelectorAll('#layerSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === layer)));
  store.set('earth-layer', layer);
}

async function loadElevation() {
  try {
    const res = await fetch(ELEV.url);
    if (!res.ok) throw new Error(res.status);
    elevGrid = new Int16Array(await res.arrayBuffer());
    if (state.siteId) selectSite(state.siteId);
  } catch (err) { console.warn('Elevation grid not loaded', err); }
}

// Returns "812 m", "ocean", "no SRTM data" or '' while loading.
function elevText(lat, lon, sep = '') {
  if (!elevGrid) return '';
  const row = Math.min(ELEV.h - 1, Math.max(0, Math.floor((90 - lat) / ELEV.res)));
  const col = ((Math.floor((lon + 180) / ELEV.res) % ELEV.w) + ELEV.w) % ELEV.w;
  const v = elevGrid[row * ELEV.w + col];
  const txt = v === ELEV.ocean ? 'ocean' : v === ELEV.nodata ? 'no SRTM data' : `${v.toLocaleString('en-US')} m`;
  return sep + txt;
}

// ---------- field rover ----------
const ST_LABEL = { off: 'Offline', connecting: 'Connecting…', waiting: 'Waiting for data', error: 'Not connected' };

function initStation() {
  station = new Station(stCfg.medidas.map((m) => m.id));
  station.onChange = renderStation;
  station.onChoice = followTerminal;
  $('stBroker').value = store.get('st-broker') || stCfg.mqtt.broker;
  $('stTopic').value = store.get('st-topic') || stCfg.mqtt.topico;
  $('roverBtn').onclick = () => $('station').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  $('stCsv').onclick = () => {
    const url = URL.createObjectURL(new Blob([station.csv()], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `rover-${station.mode}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!station.supportsUsb) $('stModes').querySelector('[data-mode=usb]').title = 'USB needs Chrome or Edge on a computer';
  $('stModes').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      const m = b.dataset.mode;
      $('stMqtt').hidden = m !== 'mqtt';
      if (m === 'usb') station.connectUsb(stCfg.serial_baud);
      if (m === 'mqtt') { syncModes('mqtt'); $('stBroker').focus(); }
    };
  });
  $('stMqtt').onsubmit = (e) => {
    e.preventDefault();
    const broker = $('stBroker').value.trim(), topic = $('stTopic').value.trim();
    if (!broker || !topic) return;
    store.set('st-broker', broker); store.set('st-topic', topic); store.set('st-mode', 'mqtt');
    station.connectMqtt(broker, topic);
  };
  // no simulated data: listen on the team's MQTT topic right away, so whatever the bridge
  // (ponte_serial_mqtt.py / controle_carrinho.py) publishes from the rover shows up here
  station.connectMqtt($('stBroker').value, $('stTopic').value);
}

// The site and target picked in the terminal (bridge --local <id>, or the C app's menu)
// arrive by MQTT; switch the globes to them. The C app's choice carries the target the
// user picked, so it wins over the bridge profile's default target for the same site.
let lastSelecao = null;
function followTerminal(c) {
  if (c.kind === 'selecao') lastSelecao = c;
  else if (lastSelecao && lastSelecao.site === c.site) c = lastSelecao;
  const site = sites.find((x) => x.id === c.site);
  let target = cfg.alvos.find((a) => a.id === c.target);
  if (!target && !site) return;
  if (!target) target = cfg.alvos.find((a) => a.id === state.targetId);
  const siteId = site ? site.id : null;
  if (target.corpo !== state.body) setBody(target.corpo, { targetId: target.id, siteId });
  else if (target.id !== state.targetId) selectTarget(target.id, { siteId, focus: true });
  else if (siteId && siteId !== state.siteId) selectSite(siteId, { focus: true });
}

// photo carousel under the rover table: scroll-snap track, arrows, dots, centre slide highlighted
function initRoverGallery() {
  const root = $('roverGallery');
  if (!root) return;
  const track = root.querySelector('.rg-track');
  const slides = [...track.querySelectorAll('.rg-slide')];
  const dots = root.querySelector('.rg-dots');
  dots.innerHTML = slides.map((_, i) => `<button type="button" role="tab" aria-label="Photo ${i + 1}"></button>`).join('');
  const dotBtns = [...dots.children];
  let cur = 0;
  const go = (i) => {
    cur = (i + slides.length) % slides.length;
    const s = slides[cur];
    track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const mark = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bd = Infinity;
    slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    cur = best;
    slides.forEach((s, i) => s.classList.toggle('on', i === best));
    dotBtns.forEach((b, i) => b.setAttribute('aria-selected', String(i === best)));
  };
  dotBtns.forEach((b, i) => { b.onclick = () => go(i); });
  root.querySelectorAll('.rg-nav button').forEach((b) => { b.onclick = () => go(cur + Number(b.dataset.dir)); });
  slides.forEach((s, i) => { s.onclick = () => go(i); });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(cur + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
  let raf = 0;
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark); }, { passive: true });
  window.addEventListener('resize', mark);
  slides.forEach((s) => s.querySelector('img').addEventListener('load', mark));
  mark();
}

function syncModes(mode) {
  $('stModes').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
}

function renderStation() {
  if (!station || !stCfg) return;
  const { mode, status, detail } = station;
  syncModes(mode);
  const live = status === 'live';
  const text = live ? (mode === 'usb' ? 'Live · USB' : 'Live · Web') : ST_LABEL[status];
  $('stStatus').dataset.status = status;
  $('stStatusText').textContent = text;
  $('roverDot').dataset.status = $('stStatus').dataset.status;
  $('stDetail').textContent = detail;
  $('stCsv').hidden = !station.log.length;

  const t = cfg?.alvos.find((a) => a.id === state.targetId);
  const r = state.ranked.find((x) => x.site.id === state.siteId);
  $('stTarget').textContent = t ? t.nome : '–';
  const targetCol = t ? t.nome : 'Target', siteCol = r ? shortName(r.site) : 'Earth twin';
  $('stColTarget').textContent = targetCol;
  $('stColSite').textContent = siteCol;
  const ref = { ...(stCfg.referencias[t?.corpo] || {}), ...(stCfg.referencias[t?.id] || {}) };

  // Rows: the sensors our rover has (carrinho) plus any measure that has received data.
  const rows = stCfg.medidas.filter((m) => m.carrinho || station.history[m.id]?.length);
  $('stBody').innerHTML = rows.map((m) => {
    const v = station.latest[m.id];
    const now = v == null ? '<span class="na">–</span>'
      : `<b>${v.toFixed(m.casas)}</b> <span class="u">${esc(m.unidade)}</span>`;
    const sv = r && m.local ? r.site[m.local] : null;
    const site = sv == null ? '<span class="na">–</span>'
      : `${Number(sv).toFixed(m.local_casas ?? m.casas)} <span class="u">${esc(m.local_unidade ?? m.unidade)}</span>${m.local_nome ? ` <span class="u">(${esc(m.local_nome)})</span>` : ''}`;
    let drop = '';
    if (m.id === 'solar' && station.solarFraction != null) {
      const d = Math.round((1 - station.solarFraction) * 100);
      if (d >= 10) drop = ` <span class="drop" title="Below the best reading of this session (dust on the panel)">−${d}%</span>`;
    }
    return `<tr><th scope="row">${esc(m.nome)}</th><td class="now">${now}${drop}${spark(station.history[m.id])}</td><td class="site" data-label="${esc(siteCol)}">${site}</td><td class="ref" data-label="${esc(targetCol)}">${esc(ref[m.id] || '–')}</td></tr>`;
  }).join('');
}

function spark(h) {
  if (!h || h.length < 2) return '';
  const lo = Math.min(...h), hi = Math.max(...h), span = hi - lo || 1;
  const pts = h.map((v, i) => `${(i / (h.length - 1) * 80).toFixed(1)},${(18 - (v - lo) / span * 16).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 80 20" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const target = () => cfg.alvos.find((a) => a.id === state.targetId);

/* ---------------- body + target ---------------- */

function setBody(body, { targetId = null, siteId = null } = {}) {
  state.body = body;
  document.querySelectorAll('.topbar .seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.body === body)));
  const targets = cfg.alvos.filter((a) => a.corpo === body);
  const bt = BODY[body].tex;
  bodyGlobe.setTexture(TEXTURES[body], { ...bt, bumpUrl: bt.bumpUrl && TEXTURES[bt.bumpUrl], normalUrl: bt.normalUrl && TEXTURES[bt.normalUrl] });
  bodyGlobe.radiusKm = BODY[body].radiusKm;
  bodyGlobe.ui.home.setAttribute('aria-label', `Show the whole ${BODY[body].name}`);
  bodyGlobe.ui.home.title = `Whole ${BODY[body].name}`;
  bodyGlobe._scaleKey = null;
  bodyGlobe.setMarkers(targets.map((t) => ({ id: t.id, lat: t.lat, lon: t.lon, label: t.nome, kind: 'target', color: '#7cb6ff', showLabel: phone,
    // phone: the title already shows the coordinates, keep the pin label short
    labelHtml: phone ? esc(t.nome.split(' ')[0]) : `${esc(t.nome)}<span class="ll">${fmtLat(t.lat, 2)}, ${fmtLon(t.lon, 2)}</span>` })));

  renderTargetChips(targets, targetId || targets[0].id);
  // phone: the chips are hidden; the title opens the native picker instead
  $('targetSelect').innerHTML = targets.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('');
  $('targetSelect').onchange = (e) => selectTarget(e.target.value, { focus: true });

  selectTarget(targetId || targets[0].id, { siteId });
}

// a few chips under the globe; the ▾ on the title lists every target
function renderTargetChips(targets, activeId) {
  const shown = targets.slice(0, 3);
  const active = targets.find((t) => t.id === activeId);
  if (active && !shown.includes(active)) shown[2] = active;
  const more = targets.length - shown.length;
  $('targetChips').innerHTML = shown.map((t) =>
    `<button class="chip" role="option" data-id="${t.id}" aria-selected="${t.id === activeId}">${esc(shortTarget(t))}</button>`).join('')
    + (more > 0 ? `<button class="chip more" type="button" data-more>+${more} more</button>` : '');
  $('targetChips').querySelectorAll('button[data-id]').forEach((b) => { b.onclick = () => selectTarget(b.dataset.id, { focus: true }); });
  const mb = $('targetChips').querySelector('[data-more]');
  if (mb) mb.onclick = (e) => { e.stopPropagation(); toggleTargetMenu(targets, mb); };
  fitChips($('targetChips'), targets.length);
}

// "+N more" opens a small list with every target of this body (showPicker on the hidden
// <select> did nothing in Safari/Firefox and in some Chrome builds)
function toggleTargetMenu(targets, anchor) {
  let menu = $('targetMenu');
  if (menu) { menu.remove(); return; }
  menu = document.createElement('div');
  menu.id = 'targetMenu';
  menu.className = 'target-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'All targets');
  menu.innerHTML = targets.map((t) =>
    `<button type="button" role="option" data-id="${t.id}" aria-selected="${t.id === state.targetId}">${esc(t.nome)}</button>`).join('');
  anchor.closest('.world').appendChild(menu);
  menu.querySelectorAll('button').forEach((b) => { b.onclick = () => { menu.remove(); selectTarget(b.dataset.id, { focus: true }); }; });
  const close = (ev) => {
    if (!document.body.contains(menu)) return document.removeEventListener('pointerdown', close, true);
    if (!menu.contains(ev.target) && ev.target !== anchor) { menu.remove(); document.removeEventListener('pointerdown', close, true); }
  };
  document.addEventListener('pointerdown', close, true);
  document.addEventListener('keydown', function onKey(ev) { if (ev.key === "Escape") { menu.remove(); document.removeEventListener("keydown", onKey); } });
  menu.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

// drop chips from the end (never the selected one) until the row fits; the "+N" chip counts them
function fitChips(row, total) {
  const moreBtn = row.querySelector('[data-more], [data-all]');
  if (!moreBtn) return;
  const items = () => [...row.querySelectorAll('button[data-id]')];
  const label = () => {
    const n = total - items().length;
    moreBtn.hidden = n <= 0;
    moreBtn.textContent = `+${n}${phone ? '' : ' more'}`;
    moreBtn.setAttribute('aria-label', `${n} more`);
  };
  label();
  while (row.scrollWidth > row.clientWidth + 1 && items().length > 1) {
    const list = items();
    const drop = [...list].reverse().find((b) => b.getAttribute('aria-selected') !== 'true') || list[list.length - 1];
    drop.remove();
    label();
  }
}

function shortTarget(t) { return t.nome.replace(/ (crater rim|crater|skylight|Massif)$/i, (m) => (/massif/i.test(m) ? m : '')); }

function selectTarget(id, { siteId = null, focus = false } = {}) {
  const t = cfg.alvos.find((a) => a.id === id);
  if (!t) return;
  state.targetId = id;
  bodyGlobe.setActive(id);
  if (focus) bodyGlobe.focus(t.lat, t.lon);
  else bodyGlobe.flyTo(t.lat, t.lon);
  if (!$('targetChips').querySelector(`[data-id="${id}"]`)) renderTargetChips(cfg.alvos.filter((a) => a.corpo === t.corpo), id);
  $('targetChips').querySelectorAll('button[data-id]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
  $('bodyKicker').textContent = `${BODY[t.corpo].name} · target`;
  $('targetName').textContent = t.nome;
  $('targetSelect').value = id;
  $('targetWhere').textContent = `${t.regiao} · ${t.coord_aprox ? '≈ ' : ''}${fmtLat(t.lat, 2)}, ${fmtLon(t.lon, 2)}`;
  refreshRanking(siteId);
}

/* ---------------- ranking ---------------- */

function refreshRanking(keepSite = state.siteId) {
  const ranked = rankSites(sites, state.targetId, state.weights);
  state.ranked = ranked;
  earthGlobe.setMarkers(ranked.map((r) => ({
    id: r.site.id, lat: r.site.lat, lon: r.site.lon, kind: 'analog',
    color: scoreColor(r.score), size: 0.6 + r.score * 0.8, label: shortName(r.site),
    labelHtml: `${esc(shortName(r.site))}<span class="ll">${fmtLat(r.site.lat, 2)}, ${fmtLon(r.site.lon, 2)}</span>`,
  })));

  const more = ranked.length - TOP_CHIPS;
  $('rankChips').innerHTML = ranked.slice(0, TOP_CHIPS).map((r, i) => `
    <button class="chip" data-id="${r.site.id}" aria-selected="false"><span class="n">${i + 1}</span>${esc(chipName(r.site))}
      <span class="s" style="color:${scoreColor(r.score)}">${pct(r.score)}</span></button>`).join('')
    + (more > 0 ? `<button class="chip" data-all="1" aria-label="${more} more sites">+${more}${phone ? '' : ' more'}</button>` : '');
  $('rankChips').querySelectorAll('button').forEach((b) => {
    b.onclick = () => (b.dataset.all ? openDrawer('list') : selectSite(b.dataset.id, { focus: true }));
  });
  fitChips($('rankChips'), ranked.length);

  const keep = keepSite && ranked.some((r) => r.site.id === keepSite);
  selectSite(keep ? keepSite : ranked[0]?.site.id);
}

function selectSite(id, { focus = false } = {}) {
  const r = state.ranked.find((x) => x.site.id === id);
  if (!r) return;
  state.siteId = id;
  earthGlobe.setActive(id);
  if (focus) earthGlobe.focus(r.site.lat, r.site.lon);
  else if (id !== earthGlobe.activeFlightId) earthGlobe.flyTo(r.site.lat, r.site.lon);
  earthGlobe.activeFlightId = id;
  $('rankChips').querySelectorAll('button[data-id]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));

  $('siteName').textContent = siteName(r.site);
  $('siteCity').textContent = [r.site.cidade, r.site.regiao].filter(Boolean).join(', ');
  $('siteTemp').textContent = Number.isFinite(r.site.temp_media_c) ? `${r.site.temp_media_c.toFixed(0)} °C` : '–';
  const dp = phone ? 1 : 2;
  $('siteCoords').textContent = `${r.site.coord_aprox ? '≈ ' : ''}${fmtLat(r.site.lat, dp)}, ${fmtLon(r.site.lon, dp)}${elevText(r.site.lat, r.site.lon, ' · ').replace(/ m$/, '\u00a0m')}`;
  $('matchScore').textContent = pct(r.score);
  $('matchScore').style.color = scoreColor(r.score);
  $('mScore').innerHTML = `<b style="color:${scoreColor(r.score)}">${pct(r.score)}</b> match`;
  $('matchBadge').setAttribute('aria-label', `${pct(r.score)} match. Open details`);

  if ($('drawer').classList.contains('open')) openDrawer('analog');
  history.replaceState(null, '', `#${state.body}/${state.targetId}/${id}`);
  renderStation();
}

const isClassic = (s) => /^refer/.test(s.papel || '');
const isBR = (s) => /\bBR$/.test(s.regiao || '');
const siteName = (s) => s.nome_en || s.nome;
// phone chips: long names keep only the first word ("McMurdo Dry Valleys" -> "McMurdo")
const chipName = (s) => { const n = shortName(s); return phone && n.length > 12 ? n.split(' ')[0] : n; };
function shortName(s) {
  if (s.nome_curto) return s.nome_curto;
  return siteName(s).replace(/^(Domo de|Cratera de|Serra Norte de)\s+/i, '').replace(/\s*\(.*\)$/, '').replace(/, Yungay$/, '').replace(/ (crater|Dome|caves)$/i, '');
}

/* ---------------- link between the two globes ---------------- */

function drawLink() {
  const twin = $('twin').getBoundingClientRect();
  const a = bodyGlobe.screenPos(state.targetId), b = earthGlobe.screenPos(state.siteId);
  const svg = $('link');
  if (!a || !b) { svg.classList.add('off'); return; }
  const ra = bodyGlobe.container.getBoundingClientRect(), rb = earthGlobe.container.getBoundingClientRect();
  const ax = ra.left - twin.left + a.x, ay = ra.top - twin.top + a.y;
  const bx = rb.left - twin.left + b.x, by = rb.top - twin.top + b.y;
  const vertical = rb.top > ra.top + 10;
  const badge = $('matchBadge');
  let d;
  if (vertical) {
    // stacked (phone) layout: the badge is hidden, one S-curve from top to bottom
    const k = (by - ay) * 0.5;
    d = `M${ax},${ay} C${ax},${ay + k} ${bx},${by - k} ${bx},${by}`;
  } else {
    // the badge stays still in the middle of the seam; the link runs through it
    const mx = twin.width / 2, my = twin.height / 2;
    const k1 = (mx - ax) * 0.55, k2 = (bx - mx) * 0.55;
    d = `M${ax},${ay} C${ax + k1},${ay} ${mx - k1},${my} ${mx},${my} C${mx + k2},${my} ${bx - k2},${by} ${bx},${by}`;
    badge.style.left = `${mx}px`;
    badge.style.top = `${my}px`;
  }
  $('linkPath').setAttribute('d', d);
  // gradient in page units: with the default (bounding-box) units, a perfectly vertical
  // line has a zero-width box and the browser draws nothing
  const g = $('linkGrad');
  g.setAttribute('x1', ax); g.setAttribute('y1', ay); g.setAttribute('x2', bx); g.setAttribute('y2', by + (bx === ax && by === ay ? 1 : 0));
  $('linkA').setAttribute('cx', ax); $('linkA').setAttribute('cy', ay);
  $('linkB').setAttribute('cx', bx); $('linkB').setAttribute('cy', by);
  const inside = (p, r) => p.x >= 0 && p.y >= 0 && p.x <= r.width && p.y <= r.height;
  svg.classList.toggle('off', a.facing < 0.06 || b.facing < 0.06 || !inside(a, ra) || !inside(b, rb));
}

/* ---------------- info cards pinned to the chosen place ---------------- */

// Each world's info card sits next to its pin, on the first side (in `prefs` order) where it
// fits inside the panel; it keeps its side while it still fits, so it does not jump around.
// When the pin is behind the globe or nowhere fits, the card docks in the panel's top corner.
function placeCard(globe, card, id, prefs) {
  const sec = card.parentElement;
  const sr = sec.getBoundingClientRect(), gr = globe.container.getBoundingClientRect();
  const cw = card.offsetWidth, ch = card.offsetHeight;
  const m = 8, gap = 15;
  const chips = sec.querySelector('.chips');
  const bottom = chips && chips.offsetParent && chips.children.length ? chips.offsetTop - 4 : sr.height - m;
  const side = phone ? m : 62;   // keep clear of the zoom buttons on the outer edges
  const B = { l: card.id === 'bodyCard' ? side : m, t: m, r: sr.width - (card.id === 'earthCard' ? side : m), b: Math.min(bottom, gr.bottom - sr.top - m) };
  const p = globe.screenPos(id);
  let pos = null;
  if (p && p.facing > 0.06) {
    const px = gr.left - sr.left + p.x, py = gr.top - sr.top + p.y;
    if (px >= B.l && px <= B.r && py >= B.t && py <= B.b) {
      const clampX = (x) => Math.min(Math.max(x, B.l), B.r - cw), clampY = (y) => Math.min(Math.max(y, B.t), B.b - ch);
      const at = {
        above: () => ({ x: clampX(px - cw / 2), y: py - gap - ch }),
        below: () => ({ x: clampX(px - cw / 2), y: py + gap }),
        left: () => ({ x: px - gap - cw, y: clampY(py - ch / 2) }),
        right: () => ({ x: px + gap, y: clampY(py - ch / 2) }),
      };
      const fits = (c, e = 0) => c.x >= B.l + e && c.y >= B.t + e && c.x + cw <= B.r - e && c.y + ch <= B.b - e;
      // the most preferred side that fits wins; moving off the current side needs some room to
      // spare, so the card does not flip back and forth at the edge
      const cur = card.dataset.side;
      for (const side of prefs) {
        const c = at[side]();
        if (fits(c, side === cur ? -0.5 : 10)) { pos = { ...c, side, px, py }; break; }
      }
    }
  }
  if (pos) {
    card.dataset.side = pos.side;
    card.style.setProperty('--ax', `${Math.min(Math.max(pos.px - pos.x, 14), cw - 14)}px`);
    card.style.setProperty('--ay', `${Math.min(Math.max(pos.py - pos.y, 14), ch - 14)}px`);
  } else {
    delete card.dataset.side;
    const right = card.id === 'earthCard' && !phone;
    pos = { x: right ? B.r - cw : B.l + 8, y: B.t };
  }
  card.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
  card.classList.remove('unplaced');
}

/* ---------------- mission profile ---------------- */

function buildProfile() {
  $('presets').innerHTML = cfg.perfis.map((p) => `<button data-id="${p.id}" aria-pressed="false">${esc(p.label.replace(' (equal weights)', ''))}</button>`).join('');
  $('presets').querySelectorAll('button').forEach((b) => { b.onclick = () => applyProfile(b.dataset.id); });
  $('sliders').innerHTML = cfg.dimensoes.map((d) => `
    <label>${esc(d.label)}<input type="range" min="0" max="3" step="1" data-dim="${d.id}"><output data-o="${d.id}"></output></label>`).join('');
  $('sliders').querySelectorAll('input').forEach((inp) => {
    inp.oninput = () => {
      state.weights[inp.dataset.dim] = Number(inp.value);
      state.profileId = 'custom';
      syncProfileUi();
      refreshRanking();
    };
  });
  applyProfile('general', false);
}

function applyProfile(id, refresh = true) {
  const p = cfg.perfis.find((x) => x.id === id) || cfg.perfis[0];
  state.profileId = p.id;
  state.weights = { ...p.pesos };
  syncProfileUi();
  if (refresh) refreshRanking();
}

function syncProfileUi() {
  const p = cfg.perfis.find((x) => x.id === state.profileId);
  $('profileName').textContent = p ? p.label.replace(' (equal weights)', '') : 'Custom';
  $('presets').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.profileId)));
  cfg.dimensoes.forEach((d) => {
    const w = state.weights[d.id] ?? 0;
    document.querySelector(`[data-dim="${d.id}"]`).value = w;
    document.querySelector(`[data-o="${d.id}"]`).textContent = w ? `×${w}` : 'off';
  });
}

function toggleProfile(force) {
  const pop = $('profilePop');
  const show = force ?? pop.hidden;
  pop.hidden = !show;
  $('profileBtn').setAttribute('aria-expanded', String(show));
}

/* ---------------- details drawer ---------------- */

function openDrawer(mode) {
  $('drawerBody').innerHTML = mode === 'list' ? listHtml() : analogHtml();
  if (mode === 'list') {
    $('drawerBody').querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => { selectSite(b.dataset.id, { focus: true }); openDrawer('analog'); }; });
  }
  const share = $('shareBtn');
  if (share) share.onclick = () => shareLink(share);
  $('drawer').classList.add('open');
  $('drawer').setAttribute('aria-hidden', 'false');
  $('scrim').hidden = false;
  $('drawerClose').focus();
}

async function shareLink(btn) {
  const url = location.href;
  try {
    if (phone && navigator.share) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    btn.textContent = 'Link copied';
  } catch { btn.textContent = 'Could not copy'; }
  setTimeout(() => { btn.textContent = 'Share link'; }, 1800);
}

function closeDrawer() {
  $('drawer').classList.remove('open');
  $('drawer').setAttribute('aria-hidden', 'true');
  $('scrim').hidden = true;
}

function listHtml() {
  const t = target();
  return `<div class="d-head"><span class="kicker">All Earth twins</span><h2 id="dTitle">${esc(t.nome)}</h2><p>${esc(profileLabel())}</p></div>
    <div class="chips" style="position:static;flex-direction:column;align-items:stretch;padding:18px 0 0">
    ${state.ranked.map((r, i) => `<button class="chip" data-id="${r.site.id}" aria-selected="${r.site.id === state.siteId}" style="justify-content:space-between">
      <span><span class="n">${i + 1}</span> ${esc(siteName(r.site))} <span class="n">${esc(r.site.regiao)}</span></span>
      <span class="s" style="color:${scoreColor(r.score)}">${pct(r.score)}</span></button>`).join('')}
    </div>`;
}

function analogHtml() {
  const t = target();
  const r = state.ranked.find((x) => x.site.id === state.siteId);
  const s = r.site;
  const a = s.analogia?.[t.id] || s.analogia?.[t.corpo] || dimNotes(s.notas?.[t.id]);
  const li = (arr) => arr.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('');

  const est = (k) => (s.fontes_valores?.[k] ? ' (est.)' : '');
  const facts = [
    ['Type', s.tipo_en || s.tipo],
    ['Coordinates', `${s.coord_aprox ? '≈ ' : ''}${fmtLat(s.lat, 3)}, ${fmtLon(s.lon, 3)}`],
    ['Elevation', num(s.elev_media_m, ' m')],
    ['Mean slope', num(s.declividade_media, '°', 1)],
    ['Drivable (<15°)', s.frac_transitavel_15 != null ? pct(s.frac_transitavel_15) : null],
    ['Surface temp.', s.lst_noite_c != null && s.lst_dia_c != null ? `${num(s.lst_noite_c)} to ${num(s.lst_dia_c)} °C${est('lst_dia_c')}` : null],
    ['Mean surface temp.', s.temp_media_c != null ? `${num(s.temp_media_c)} °C${est('temp_media_c')}` : null],
    ['Rain', s.chuva_anual_mm != null ? `${num(s.chuva_anual_mm, ' mm/yr')}${est('chuva_anual_mm')}` : null],
    ['Dust (AOD)', s.aod_medio != null ? `${num(s.aod_medio, '', 2)}${est('aod_medio')}` : null],
    ['Albedo', s.albedo_medio != null ? `${num(s.albedo_medio, '', 2)}${est('albedo_medio')}` : null],
    ['Vegetation (NDVI)', s.ndvi_medio != null ? `${num(s.ndvi_medio, '', 2)}${est('ndvi_medio')}` : null],
  ].filter(([, v]) => v != null && v !== '').map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join('');
  const tfacts = Object.entries(t.indicadores || {}).map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join('');

  return `
    <div class="d-head">
      <span class="kicker">Earth twin of ${esc(t.nome)}</span>
      <h2 id="dTitle">${esc(siteName(s))}</h2>
      <p>${esc(s.regiao)} · ${esc(s.tipo_en || s.tipo || '')}</p>
    </div>
    <div class="d-score">
      <span class="big" style="color:${scoreColor(r.score)}">${pct(r.score)}</span>
      <span class="sub">match · #${state.ranked.indexOf(r) + 1} of ${state.ranked.length}<br>${esc(profileLabel())}</span>
    </div>
    ${radarSvg(s.notas?.[t.id] || {})}
    <div class="legend"><span><i></i>${esc(shortName(s))}</span><span><i class="t"></i>${esc(shortTarget(t))} (perfect match)</span></div>
    <div class="wb works"><h3>Where it works</h3><ul>${li(a.works || []) || '<li>No notes yet.</li>'}</ul></div>
    <div class="wb breaks"><h3>Where it breaks</h3><ul>${li(a.breaks || [])}</ul>
      <div class="always" title="${esc(cfg.sempre_quebra.join(' · '))}">${ALWAYS_SHORT.map((x) => `<span>${x}</span>`).join('')}</div></div>
    <details class="more"><summary>More data</summary>
      <div class="facts">${facts}</div>
      <h3 style="font-size:13px;margin:16px 0 0;color:var(--muted)">${esc(t.nome)}</h3>
      <div class="facts">${tfacts}</div>
      <p class="src">Target data: ${esc((t.fontes || []).join(' · '))}</p>
    </details>
    <div class="d-actions">
      <a class="ghost small" href="https://www.google.com/maps/@${s.lat},${s.lon},11z/data=!3m1!1e3" target="_blank" rel="noopener">See it on a map ↗</a>
      <button class="ghost small" type="button" id="shareBtn">Share link</button>
    </div>`;
}

// no written notes for this world: name the strongest and weakest dimensions instead
function dimNotes(dims = {}) {
  const list = cfg.dimensoes.filter((d) => typeof dims[d.id] === 'number').map((d) => ({ label: d.label, v: dims[d.id] }));
  list.sort((x, y) => y.v - x.v);
  return {
    works: list.slice(0, 2).filter((x) => x.v >= 0.5).map((x) => `${x.label}: ${pct(x.v)} similar`),
    breaks: list.slice(-2).reverse().filter((x) => x.v < 0.5).map((x) => `${x.label}: only ${pct(x.v)} similar`),
  };
}

function radarSvg(dims) {
  const D = cfg.dimensoes, n = D.length, R = 92, cx = 150, cy = 125;
  const pt = (i, v) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(ang) * R * v, cy + Math.sin(ang) * R * v];
  };
  const poly = (vals) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75].map((k) => `<polygon class="grid" points="${poly(D.map(() => k))}"/>`).join('');
  const axes = D.map((_, i) => { const [x, y] = pt(i, 1); return `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('');
  const labels = D.map((d, i) => {
    const [x, y] = pt(i, 1.2);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    const on = (state.weights[d.id] ?? 0) > 0;
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" class="${on ? '' : 'off'}">${esc(d.label.split(' ')[0].replace(/&$/, ''))}</text>`;
  }).join('');
  return `<svg class="radar" viewBox="-30 0 360 250" role="img" aria-label="Similarity by dimension">
    ${rings}${axes}
    <polygon class="target" points="${poly(D.map(() => 1))}"/>
    <polygon class="earth" points="${poly(D.map((d) => dims[d.id] ?? 0))}"/>
    ${labels}</svg>`;
}

function profileLabel() {
  const p = cfg.perfis.find((x) => x.id === state.profileId);
  return p ? `${p.label} profile` : 'Custom weights';
}

function num(v, unit = '', d = 0) {
  return typeof v === 'number' ? `${v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}${unit}` : null;
}
const fmtLat = (v, d = 1) => `${Math.abs(v).toFixed(d)}°${v < 0 ? 'S' : 'N'}`;
const fmtLon = (v, d = 1) => `${Math.abs(v).toFixed(d)}°${v < 0 ? 'W' : 'E'}`;
