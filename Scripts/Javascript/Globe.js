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
  constructor(container, { zoom = 1, atmosphere = null, atmosphereStrength = 0.6, minDistance = 1.25, maxDistance = 7, idleSpin = 0 } = {}) {
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
    this.idleSpin = idleSpin;
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
    this.controls.addEventListener('start', () => { this.flight = null; this.lastInteraction = performance.now(); });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._bindPointer();

    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(container);

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  async setTexture(url, { bump = 0 } = {}) {
    this.container.classList.add('is-loading');
    const tex = await loadTexture(url, this.renderer);
    this.material.map = tex;
    this.material.bumpMap = bump ? tex : null;
    this.material.bumpScale = bump;
    this.material.color.set(0xffffff);
    this.material.needsUpdate = true;
    this.container.classList.remove('is-loading');
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Distance at which the unit sphere fits the narrower side of the viewport.
    const vHalf = (this.camera.fov * DEG) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const fit = 1.1 / Math.sin(Math.min(vHalf, hHalf));
    const ratio = this.camera.position.length() / this.homeDistance;
    this.homeDistance = fit / this.zoomFactor;
    this.controls.maxDistance = Math.max(this.controls.maxDistance, this.homeDistance * 1.6);
    this.camera.position.setLength(this.homeDistance * (this._fitted ? ratio : 1));
    this._fitted = true;
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

  /** Smoothly move the camera to look at lat/lon. */
  flyTo(lat, lon, distance = null, ms = 1200) {
    const from = this.camera.position.clone();
    const dist = distance ?? this.homeDistance;
    // Never look straight down a pole: tilt so the pole sits low on the disc and stays readable.
    const safeLat = Math.max(-55, Math.min(55, lat));
    const to = latLonToVec3(safeLat, lon, dist);
    this.flight = { from, to, t0: performance.now(), ms };
    this.lastInteraction = performance.now();
  }

  zoom(factor) {
    const d = THREE.MathUtils.clamp(this.camera.position.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    const ll = vec3ToLatLon(this.camera.position);
    this.flyTo(ll.lat, ll.lon, d, 350);
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
    // Clicking the surface picks the nearest marker (within 25°).
    let best = null, bestAng = 25 * DEG;
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
      const { from, to, t0, ms } = this.flight;
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const dir = from.clone().normalize().lerp(to.clone().normalize(), e).normalize();
      if (dir.lengthSq() < 1e-6) dir.copy(to).normalize();
      this.camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(from.length(), to.length(), e)));
      this.camera.lookAt(0, 0, 0);
      if (k >= 1) { this.flight = null; this.lastInteraction = now; }
    } else if (this.idleSpin && now - this.lastInteraction > 6000) {
      this.camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.idleSpin);
    }
    this.controls.update();

    const camDir = this.camera.position.clone().normalize();
    for (const m of this.markers.values()) {
      m.obj.visible = m.pos.dot(camDir) > 0.18; // hide markers (and their glow) on the far side
      const { pulse, glow } = m.obj.userData;
      const ph = (t * 0.9) % 1;
      if (pulse) {
        pulse.scale.setScalar(m.obj.userData.active ? 1 + 1.4 * ph : 1);
        pulse.material.opacity = m.obj.userData.active ? 0.9 * (1 - ph) : 0;
      }
      if (glow) glow.material.opacity = m.obj.userData.active ? 0.6 : 0.3;
      if (m.obj.userData.beam) m.obj.userData.beam.forEach((o) => { o.visible = !!m.obj.userData.active; });
    }

    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
    if (this.onFrame) this.onFrame();
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
