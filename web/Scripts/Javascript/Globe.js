import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

const DEG = Math.PI / 180;

/** lat/lon (degrees) -> unit vector, matching THREE.SphereGeometry's default UV layout
 *  (equirectangular texture with longitude 0 in the middle). */
export function latLonToVec3(lat, lon, r = 1) {
  const la = lat * DEG, lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

export function vec3ToLatLon(v) {
  const n = v.clone().normalize();
  return { lat: Math.asin(n.y) / DEG, lon: Math.atan2(-n.z, n.x) / DEG };
}

const loader = new THREE.TextureLoader();
const textureCache = new Map();
function loadTexture(url, renderer) {
  if (!textureCache.has(url)) {
    textureCache.set(url, new Promise((resolve, reject) => {
      loader.load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve(t);
      }, undefined, reject);
    }));
  }
  return textureCache.get(url);
}

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

/**
 * A self-contained, clickable 3D globe.
 * markers: [{ id, lat, lon, label, color, size, kind: 'target' | 'analog', showLabel }]
 */
export class Globe {
  constructor(container, { zoom = 1, atmosphere = null, atmosphereStrength = 0.6, minDistance = 1.25, maxDistance = 7, idleSpin = 0, radiusKm = 6371, name = 'globe', offsetX = 0 } = {}) {
    // offsetX: shift the globe right by this fraction of the width, without clipping it
    // (the canvas stays full width, so a zoomed-in globe can still fill the whole panel)
    this.offsetX = offsetX;
    // closest zoom, as a fraction of the whole-globe height above the surface
    this.minAltFrac = matchMedia('(max-width: 820px)').matches ? 0.5 : 0.32;
    this.radiusKm = radiusKm;
    this.minDistanceFloor = minDistance;
    this.name = name;
    this.container = container;
    this.zoomFactor = zoom; // 1 = whole globe fits the view with a small margin
    this.homeDistance = 3;
    this.markers = new Map();
    this.activeId = null;
    this.onPick = () => {};
    this.onHover = () => {};
    this.onFrame = null;
    this.flight = null;
    this.visible = true;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.idleSpin = this.reduceMotion ? 0 : idleSpin;
    this.lastInteraction = performance.now();

    const w = container.clientWidth || 300, h = container.clientHeight || 300;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, w / h, 0.05, 200);
    this.camera.position.set(0, 0.5, 3);
    this.scene.add(this.camera);

    // The "sun" follows the camera from the upper left, so the visible side is lit with a soft terminator.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x10141c, 0.35));
    const sun = new THREE.DirectionalLight(0xfff6e8, 2.6);
    sun.position.set(-3, 1.6, 2.2);
    this.camera.add(sun);

    this.material = new THREE.MeshStandardMaterial({ color: 0x333a44, roughness: 1, metalness: 0 });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), this.material);
    this.scene.add(this.sphere);

    if (atmosphere) this.scene.add(makeAtmosphere(atmosphere, atmosphereStrength));

    this.markerGroup = new THREE.Group();
    this.scene.add(this.markerGroup);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'label-layer';
    container.appendChild(this.labelLayer);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enablePan: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.8,
      minDistance, maxDistance,
    });
    this.baseRotateSpeed = 0.55;
    this.controls.addEventListener('start', () => { this.flight = null; this.zoomAnim = null; this.lastInteraction = performance.now(); });
    this.zoomAnim = null;
    this._buildZoomUi();
    this._bindWheel();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._bindPointer();

    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(container);

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  async setTexture(url, { bump = 0, bumpUrl = null, normalUrl = null, normalScale = 1 } = {}) {
    this.container.classList.add('is-loading');
    const token = (this._texToken = (this._texToken || 0) + 1);
    const [tex, bumpTex, normalTex] = await Promise.all([
      loadTexture(url, this.renderer),
      bumpUrl ? loadTexture(bumpUrl, this.renderer) : null,
      normalUrl ? loadTexture(normalUrl, this.renderer) : null,
    ]);
    if (token !== this._texToken) return; // a newer texture was requested
    if (bumpTex) bumpTex.colorSpace = THREE.NoColorSpace;
    if (normalTex) normalTex.colorSpace = THREE.NoColorSpace;
    this.material.map = tex;
    this.material.bumpMap = bump ? (bumpTex || tex) : null;
    this.material.bumpScale = bump;
    this.material.normalMap = normalTex;
    this.material.normalScale.set(normalScale, normalScale);
    this.material.color.set(0xffffff);
    this.material.needsUpdate = true;
    this.container.classList.remove('is-loading');
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.offsetX) this.camera.setViewOffset(w, h, -this.offsetX * w, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    // Distance at which the unit sphere fits the narrower side of the viewport
    // (with an offset, only the part right of the shifted centre counts).
    const vHalf = (this.camera.fov * DEG) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect * (1 - 2 * this.offsetX));
    const fit = 1.1 / Math.sin(Math.min(vHalf, hHalf));
    const ratio = this.camera.position.length() / this.homeDistance;
    this.homeDistance = fit / this.zoomFactor;
    // Zoom limits: never farther than a little past the whole-globe view, never closer than
    // ~1/3 of its height above the surface (closer, the texture blurs and the globe covers the text).
    this.controls.maxDistance = this.homeDistance * 1.12;
    this.controls.minDistance = Math.max(this.minDistanceFloor, 1 + (this.homeDistance - 1) * this.minAltFrac);
    this.camera.position.setLength(this.homeDistance * (this._fitted ? ratio : 1));
    this._fitted = true;
    this._offNow = null;
  }

  setMarkers(list) {
    for (const m of this.markers.values()) {
      this.markerGroup.remove(m.obj);
      m.label.remove();
    }
    this.markers.clear();
    for (const def of list) {
      const obj = def.kind === 'analog' ? makeAnalogMarker(def) : makeTargetMarker(def);
      const pos = latLonToVec3(def.lat, def.lon, 1.0);
      obj.position.copy(pos);
      obj.lookAt(pos.clone().multiplyScalar(2));
      obj.userData.id = def.id;
      this.markerGroup.add(obj);

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'marker-label hidden';
      label.innerHTML = def.labelHtml ?? escapeHtml(def.label);
      label.addEventListener('click', (e) => { e.stopPropagation(); this.onPick(def.id); });
      this.labelLayer.appendChild(label);

      this.markers.set(def.id, { def, obj, label, pos });
    }
    this.setActive(this.activeId);
  }

  setActive(id) {
    this.activeId = id;
    for (const [mid, m] of this.markers) {
      const on = mid === id;
      m.label.classList.toggle('active', on);
      m.size = null;
      m.obj.userData.active = on;
      m.obj.scale.setScalar(on ? 1.35 : 1);
    }
  }

  /** Screen position (px, relative to the container) of a marker, and whether it is on the visible side. */
  screenPos(id) {
    const m = this.markers.get(id);
    if (!m) return null;
    const v = m.pos.clone().project(this.camera);
    const facing = m.pos.dot(this.camera.position.clone().normalize());
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight, facing };
  }

  /**
   * Fly the camera to look at lat/lon along an arc: the globe turns under the camera,
   * and on long trips the camera rises a little mid-way, like a flight.
   * distance: final distance from the centre (null keeps the current zoom, capped at the whole-globe view).
   */
  flyTo(lat, lon, distance = null, ms = null) {
    const from = this.camera.position.clone();
    const dist = distance ?? Math.min(this.homeDistance, from.length());
    // Never look straight down a pole: the pole sits a bit off the centre and stays readable.
    // close in, look almost straight at the place (polar targets stay near the centre)
    const limit = dist < this.homeDistance * 0.8 ? 84 : 55;
    const safeLat = Math.max(-limit, Math.min(limit, lat));
    const to = latLonToVec3(safeLat, lon, dist);
    const ang = from.angleTo(to);                         // radians to travel
    const rise = Math.min(0.9, ang / Math.PI) * (this.homeDistance - 1) * 0.55;
    const time = ms ?? THREE.MathUtils.clamp(700 + ang * 520 + Math.abs(from.length() - dist) * 260, 700, 2200);
    this.zoomAnim = null;
    this.flight = { from, to, t0: performance.now(), ms: this.reduceMotion ? 1 : time, rise: this.reduceMotion ? 0 : rise };
    this.lastInteraction = performance.now();
  }

  /** Fly in close to a place (used when the user clicks it). */
  focus(lat, lon) {
    this.flyTo(lat, lon, 1 + (this.homeDistance - 1) * 0.62);
  }

  /** Back to the whole-globe view, looking at the same place. */
  home() {
    const ll = vec3ToLatLon(this.camera.position);
    this.flyTo(ll.lat, ll.lon, this.homeDistance, 700);
  }

  /**
   * Zoom by `factor` (<1 = closer). With a surface point, the camera also turns toward it,
   * so the place under the cursor stays under the cursor (like a map).
   */
  zoom(factor, toward = null) {
    this.flight = null;
    const c = this.controls;
    const cur = this.zoomAnim ? this.zoomAnim.dist : this.camera.position.length();
    const dist = THREE.MathUtils.clamp(cur * factor, c.minDistance, c.maxDistance);
    let dir = (this.zoomAnim ? this.zoomAnim.dir : this.camera.position.clone().normalize()).clone();
    if (toward && dist < cur) {
      // fraction of the way to the point: how much closer to the surface we get
      const k = THREE.MathUtils.clamp(1 - (dist - 1) / (cur - 1), 0, 1);
      const target = toward.clone().normalize();
      const ang = dir.angleTo(target);
      if (ang > 1e-4) {
        const axis = new THREE.Vector3().crossVectors(dir, target).normalize();
        dir.applyAxisAngle(axis, ang * k);
      }
    }
    this.zoomAnim = { dist, dir };
    this.lastInteraction = performance.now();
  }

  _buildZoomUi() {
    const ui = document.createElement('div');
    ui.className = 'zoom-ui';
    ui.innerHTML = `
      <div class="zoom-ctl" role="group" aria-label="Zoom ${this.name}">
        <button type="button" data-z="in" aria-label="Zoom in">+</button>
        <button type="button" data-z="out" aria-label="Zoom out">−</button>
        <button type="button" data-z="home" aria-label="Show the whole ${this.name}" title="Whole ${this.name}">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="zoom-scale" aria-hidden="true"><i></i><span></span></div>
      <div class="zoom-hint" aria-hidden="true"></div>`;
    this.container.appendChild(ui);
    ui.querySelector('[data-z=in]').onclick = () => this.zoom(0.6);
    ui.querySelector('[data-z=out]').onclick = () => this.zoom(1 / 0.6);
    ui.querySelector('[data-z=home]').onclick = () => this.home();
    this.ui = { root: ui, bar: ui.querySelector('.zoom-scale i'), text: ui.querySelector('.zoom-scale span'), hint: ui.querySelector('.zoom-hint'), home: ui.querySelector('[data-z=home]'), zin: ui.querySelector('[data-z=in]'), zout: ui.querySelector('[data-z=out]') };
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    this.ui.hint.textContent = `${mac ? '⌘' : 'Ctrl'} + scroll to zoom`;
  }

  _bindWheel() {
    // Plain wheel scrolls the page (the site scrolls down to the rover section).
    // Ctrl/⌘ + wheel, or a trackpad pinch (sent as ctrl+wheel), zooms toward the cursor.
    // Capture phase on the container, so OrbitControls never sees the wheel.
    this.container.addEventListener('wheel', (e) => {
      e.stopPropagation();
      if (!(e.ctrlKey || e.metaKey)) { this._showHint(); return; }
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(THREE.MathUtils.clamp(delta, -120, 120) * 0.0022);
      const hit = this._raycast(e, [this.sphere]);
      this.zoom(factor, hit ? hit.point : null);
    }, { capture: true, passive: false });
    this.renderer.domElement.addEventListener('dblclick', (e) => {
      const hit = this._raycast(e, [this.sphere]);
      if (hit) this.zoom(e.shiftKey ? 1 / 0.5 : 0.5, hit.point);
    });
  }

  _showHint() {
    const h = this.ui.hint;
    h.classList.add('show');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => h.classList.remove('show'), 1400);
  }

  _updateZoomUi() {
    const d = this.camera.position.length();
    const h = this.container.clientHeight || 1;
    const kmPerPx = (2 * (d - 1) * Math.tan((this.camera.fov * DEG) / 2) / h) * this.radiusKm;
    const maxKm = kmPerPx * 90;
    const p = Math.pow(10, Math.floor(Math.log10(maxKm)));
    const nice = [5, 2, 1].map((m) => m * p).find((v) => v <= maxKm) || p;
    const px = nice / kmPerPx;
    const key = `${nice}|${Math.round(px)}`;
    if (key !== this._scaleKey) {
      this._scaleKey = key;
      this.ui.bar.style.width = `${px.toFixed(0)}px`;
      this.ui.text.textContent = `${nice.toLocaleString('en-US')} km`;
    }
    const c = this.controls;
    const target = this.zoomAnim ? this.zoomAnim.dist : d;
    this.ui.zin.disabled = target <= c.minDistance * 1.01;
    this.ui.zout.disabled = target >= c.maxDistance * 0.99;
    const zoomed = d < this.homeDistance * 0.92;
    if (zoomed !== this._zoomed) {
      this._zoomed = zoomed;
      this.ui.root.classList.toggle('zoomed', zoomed);
    }
  }

  _bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return; // a drag, not a click
      this._click(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const hit = this._raycast(e, [this.sphere]);
      this.onHover(hit ? vec3ToLatLon(hit.point) : null);
      el.style.cursor = this._raycast(e, this.markerGroup.children, true) ? 'pointer' : '';
    });
    el.addEventListener('pointerleave', () => this.onHover(null));
  }

  _raycast(e, objects, recursive = false) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(objects, recursive)[0] || null;
  }

  _click(e) {
    const mk = this._raycast(e, this.markerGroup.children, true);
    if (mk) {
      let o = mk.object;
      while (o && o.userData.id === undefined) o = o.parent;
      if (o) return this.onPick(o.userData.id);
    }
    const hit = this._raycast(e, [this.sphere]);
    if (!hit) return;
    // Clicking the surface picks the nearest marker (within 25° in the whole view, less when zoomed in).
    let best = null, bestAng = THREE.MathUtils.clamp(25 * this._altFrac(), 2, 25) * DEG;
    for (const [id, m] of this.markers) {
      const ang = m.pos.angleTo(hit.point);
      if (ang < bestAng) { bestAng = ang; best = id; }
    }
    if (best) this.onPick(best);
  }

  _tick() {
    if (!this.visible) return;
    const t = this.clock.getElapsedTime();
    const now = performance.now();
    if (this.flight) {
      const { from, to, t0, ms, rise = 0 } = this.flight;
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;       // ease in-out
      // turn along the great circle (slerp), so the globe spins smoothly under the camera
      const a = from.clone().normalize(), b = to.clone().normalize();
      const omega = a.angleTo(b);
      let dir;
      if (omega < 1e-4) dir = b;
      else if (Math.PI - omega < 1e-3) dir = a.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), omega * e);
      else {
        const so = Math.sin(omega);
        dir = a.multiplyScalar(Math.sin((1 - e) * omega) / so).add(b.multiplyScalar(Math.sin(e * omega) / so));
      }
      // zoom eases a bit later than the turn, so you see where you are going before diving in
      const ez = Math.pow(e, 1.4);
      const len = THREE.MathUtils.lerp(from.length(), to.length(), ez) + rise * Math.sin(Math.PI * e);
      this.camera.position.copy(dir.normalize().multiplyScalar(len));
      this.camera.lookAt(0, 0, 0);
      if (k >= 1) { this.flight = null; this.lastInteraction = now; }
    } else if (this.zoomAnim) {
      const { dist, dir } = this.zoomAnim;
      const cur = this.camera.position.clone().normalize();
      const len = this.camera.position.length();
      const nd = cur.lerp(dir, 0.18).normalize();
      const nl = THREE.MathUtils.lerp(len, dist, 0.18);
      this.camera.position.copy(nd.multiplyScalar(nl));
      this.camera.lookAt(0, 0, 0);
      if (Math.abs(nl - dist) < 1e-4 && this.camera.position.clone().normalize().angleTo(dir) < 1e-4) this.zoomAnim = null;
      this.lastInteraction = now;
    } else if (this.idleSpin && now - this.lastInteraction > 9000 && !this._zoomed) {
      // idle: sway gently back and forth around where the user left the globe, instead of
      // turning all the way round, so the chosen place (and the link line) never goes behind it
      if (!this._idle || this._idle.t0 < this.lastInteraction) this._idle = { anchor: this.camera.position.clone(), t0: now };
      const amp = 0.45;                                    // ~26° each way
      const w = (this.idleSpin * 60) / amp;                // starts at the old spin speed
      const ang = amp * Math.sin(((now - this._idle.t0) / 1000) * w);
      this.camera.position.copy(this._idle.anchor).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    }
    const alt = this._altFrac();
    this._applyOffset(alt);
    this.controls.rotateSpeed = this.baseRotateSpeed * THREE.MathUtils.clamp(alt, 0.06, 1.2);
    this.controls.update();
    this._updateZoomUi();

    // pins keep about the same size on screen when zooming in
    const pinScale = THREE.MathUtils.clamp(alt, 0.22, 1);
    const camDir = this.camera.position.clone().normalize();
    for (const m of this.markers.values()) {
      m.obj.visible = m.pos.dot(camDir) > 0.06; // hide markers (and their glow) on the far side
      m.obj.scale.setScalar(pinScale * (m.obj.userData.active ? 1.35 : 1));
      const { pulse, glow } = m.obj.userData;
      const ph = (t * 0.9) % 1;
      if (pulse) {
        pulse.scale.setScalar(m.obj.userData.active && !this.reduceMotion ? 1 + 1.4 * ph : 1);
        pulse.material.opacity = m.obj.userData.active && !this.reduceMotion ? 0.9 * (1 - ph) : 0;
      }
      if (glow) glow.material.opacity = m.obj.userData.active ? 0.6 : 0.3;
      if (m.obj.userData.beam) m.obj.userData.beam.forEach((o) => { o.visible = !!m.obj.userData.active; });
    }

    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
    if (this.onFrame) this.onFrame();
  }

  /**
   * The off-centre shift (offsetX) fades out as the camera comes close: zoomed in, the globe
   * fills the panel from the centre, so no empty strip of space shows on the left.
   */
  _applyOffset(alt) {
    if (!this.offsetX) return;
    const altMin = (this.controls.minDistance - 1) / Math.max(1e-3, this.homeDistance - 1);
    const k = THREE.MathUtils.smoothstep(alt, altMin, altMin + (1 - altMin) * 0.85);
    const off = this.offsetX * k;
    if (this._offNow != null && Math.abs(off - this._offNow) < 5e-4) return;
    this._offNow = off;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.setViewOffset(w, h, -off * w, 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  /** Camera height above the surface, relative to the whole-globe view (1 = home). */
  _altFrac() {
    return (this.camera.position.length() - 1) / Math.max(1e-3, this.homeDistance - 1);
  }

  _updateLabels() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const camDir = this.camera.position.clone().normalize();
    const v = new THREE.Vector3();
    const placed = [];
    // Active label first; a label that would overlap one already placed is hidden.
    const order = [...this.markers].sort(([a], [b]) => (b === this.activeId) - (a === this.activeId));
    for (const [id, m] of order) {
      const facing = m.pos.dot(camDir) > 0.2;
      const show = facing && (m.def.showLabel || id === this.activeId);
      if (!show) { m.label.classList.add('hidden'); continue; }
      // a selected pin has a beam: put its label on the beam's tip
      v.copy(m.pos);
      if (m.obj.userData.beam && id === this.activeId) v.multiplyScalar(1 + 0.16 * m.obj.scale.x);
      v.project(this.camera);
      if (!m.size) m.size = { w: m.label.offsetWidth || 80, h: m.label.offsetHeight || 22 };
      const x = THREE.MathUtils.clamp((v.x * 0.5 + 0.5) * w, m.size.w / 2 + 4, w - m.size.w / 2 - 4);
      const y = (-v.y * 0.5 + 0.5) * h;
      const box = { l: x - m.size.w / 2, r: x + m.size.w / 2, t: y - m.size.h * 1.5, b: y - m.size.h * 0.5 };
      if (placed.some((p) => box.l < p.r && box.r > p.l && box.t < p.b && box.b > p.t)) { m.label.classList.add('hidden'); continue; }
      placed.push(box);
      m.label.classList.remove('hidden');
      m.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -150%)`;
    }
  }
}

function makeTargetMarker({ color = '#5aa2ff' }) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const s = 0.02;
  const mat = (o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(new THREE.CircleGeometry(s * 0.7, 24), mat(1));
  const ring = new THREE.Mesh(new THREE.RingGeometry(s * 1.6, s * 2, 48), mat(0.95));
  const pulse = new THREE.Mesh(new THREE.RingGeometry(s * 1.6, s * 1.9, 48), mat(0));
  [dot, ring, pulse].forEach((m, i) => { m.position.z = 0.003 + i * 0.001; });
  const hit = new THREE.Mesh(new THREE.CircleGeometry(s * 4, 12), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(dot, ring, pulse, hit);
  g.userData.pulse = pulse;
  return g;
}

function makeAnalogMarker({ color = '#34d399', size = 1 }) {
  // A crisp map pin: dark outline, ring in the score colour, white core,
  // a soft halo, and (when selected) a beam rising from the surface.
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const s = 0.011 * size;
  const flat = (geo, mat, z) => { const m = new THREE.Mesh(geo, mat); m.position.z = z; return m; };
  const basic = (o) => new THREE.MeshBasicMaterial({ ...o, transparent: true, depthWrite: false, side: THREE.DoubleSide });

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(), color: c, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.setScalar(s * 5);
  halo.position.z = 0.006;
  const outline = flat(new THREE.CircleGeometry(s * 1.75, 32), basic({ color: 0x050a14, opacity: 0.85 }), 0.003);
  const ring = flat(new THREE.RingGeometry(s * 0.9, s * 1.45, 40), basic({ color: c }), 0.004);
  const core = flat(new THREE.CircleGeometry(s * 0.55, 24), basic({ color: 0xffffff }), 0.005);
  const pulse = flat(new THREE.RingGeometry(s * 1.8, s * 2.15, 48), basic({ color: c, opacity: 0 }), 0.0045);

  const beamLen = 0.16;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.18, s * 0.45, beamLen, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.rotation.x = Math.PI / 2;
  beam.position.z = beamLen / 2;
  beam.visible = false;
  const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  tip.scale.setScalar(s * 4);
  tip.position.z = beamLen;
  tip.visible = false;

  const hit = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(halo, outline, ring, core, pulse, beam, tip, hit);
  g.userData.pulse = pulse;
  g.userData.glow = halo;
  g.userData.beam = [beam, tip];
  return g;
}

function makeAtmosphere(color, strength) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, k: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; uniform float k; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 4.0); gl_FragColor = vec4(c, f * k); }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.03, 64, 48), mat);
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
