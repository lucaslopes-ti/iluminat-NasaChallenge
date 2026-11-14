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

/**
 * A self-contained, clickable 3D globe.
 * markers: [{ id, lat, lon, label, sub, color, size, showLabel }]
 */
export class Globe {
  constructor(container, { distance = 3.1, atmosphere = null, minDistance = 1.25, maxDistance = 6 } = {}) {
    this.container = container;
    this.zoomFactor = distance / 3.0; // 1 = whole globe fits the view with a small margin
    this.homeDistance = distance;
    this.markers = new Map();
    this.activeId = null;
    this.onPick = () => {};
    this.onHover = () => {};
    this.onSurfaceClick = null;
    this.flight = null;
    this.visible = true;

    const w = container.clientWidth || 300, h = container.clientHeight || 300;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x02060d);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.05, 200);
    this.camera.position.set(0, 0.6, distance);
    this.scene.add(this.camera);

    // Light follows the camera so the visible side is always lit, with a soft terminator for relief.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-2.5, 1.5, 2.5);
    this.camera.add(sun);

    this.scene.add(makeStars());

    this.material = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1, metalness: 0 });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), this.material);
    this.scene.add(this.sphere);

    if (atmosphere) this.scene.add(makeAtmosphere(atmosphere));

    this.markerGroup = new THREE.Group();
    this.scene.add(this.markerGroup);

    this.labelLayer = document.createElement('div');
    this.labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2';
    container.appendChild(this.labelLayer);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enablePan: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.8,
      minDistance, maxDistance,
    });
    this.resize();
    this.controls.addEventListener('start', () => { this.flight = null; });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._bindPointer();

    new ResizeObserver(() => this.resize()).observe(container);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(container);

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  async setTexture(url) {
    const tex = await loadTexture(url, this.renderer);
    this.material.map = tex;
    this.material.color.set(0xffffff);
    this.material.needsUpdate = true;
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
    const fit = 1.12 / Math.sin(Math.min(vHalf, hHalf));
    const first = !this._fitted;
    this.homeDistance = fit * this.zoomFactor;
    this.controls.maxDistance = Math.max(this.controls.maxDistance, this.homeDistance * 1.6);
    if (first) { this._fitted = true; this.camera.position.setLength(this.homeDistance); }
  }

  setMarkers(list) {
    for (const m of this.markers.values()) {
      this.markerGroup.remove(m.obj);
      m.label.remove();
    }
    this.markers.clear();
    for (const def of list) {
      const obj = makeMarker(def);
      const pos = latLonToVec3(def.lat, def.lon, 1.0);
      obj.position.copy(pos);
      obj.lookAt(pos.clone().multiplyScalar(2));
      obj.userData.id = def.id;
      this.markerGroup.add(obj);

      const label = document.createElement('div');
      label.className = 'marker-label' + (def.small ? ' small' : '');
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
      m.obj.scale.setScalar(on ? 1.5 : 1);
    }
  }

  /** Smoothly move the camera to look at lat/lon. */
  flyTo(lat, lon, distance = null, ms = 1100) {
    const from = this.camera.position.clone();
    const dist = distance ?? this.homeDistance;
    // Never look exactly down a pole: tilt so the pole sits low on the disc and stays readable.
    const safeLat = Math.max(-55, Math.min(55, lat));
    const to = latLonToVec3(safeLat, lon, dist);
    this.flight = { from, to, t0: performance.now(), ms };
  }

  zoom(factor) {
    const d = THREE.MathUtils.clamp(this.camera.position.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    const ll = vec3ToLatLon(this.camera.position);
    this.flyTo(ll.lat, ll.lon, d, 350);
  }

  resetView() { this.flyTo(15, 0, this.homeDistance); }

  _bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return; // it was a drag, not a click
      this._click(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const hit = this._raycast(e, [this.sphere]);
      this.onHover(hit ? vec3ToLatLon(hit.point) : null);
      const mk = this._raycast(e, this.markerGroup.children, true);
      el.style.cursor = mk ? 'pointer' : '';
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
    const ll = vec3ToLatLon(hit.point);
    if (this.onSurfaceClick) return this.onSurfaceClick(ll);
    // Default: choose the nearest marker to where the user clicked (within 25 degrees).
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
    if (this.flight) {
      const { from, to, t0, ms } = this.flight;
      let k = Math.min(1, (performance.now() - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const dir = from.clone().normalize().lerp(to.clone().normalize(), e).normalize();
      if (dir.lengthSq() < 1e-6) dir.copy(to).normalize();
      this.camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(from.length(), to.length(), e)));
      this.camera.lookAt(0, 0, 0);
      if (k >= 1) this.flight = null;
    }
    this.controls.update();

    // pulse active marker
    for (const m of this.markers.values()) {
      const pulse = m.obj.userData.pulse;
      if (pulse) {
        const s = m.obj.userData.active ? 1 + 0.6 * ((t * 1.2) % 1) : 1;
        pulse.scale.setScalar(s);
        pulse.material.opacity = m.obj.userData.active ? 0.9 * (1 - ((t * 1.2) % 1)) : 0.55;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }

  _updateLabels() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const camDir = this.camera.position.clone().normalize();
    const v = new THREE.Vector3();
    const placed = [];
    // Active label first, then the rest; a label that would overlap one already placed is hidden.
    const order = [...this.markers].sort(([a], [b]) => (b === this.activeId) - (a === this.activeId));
    for (const [id, m] of order) {
      const facing = m.pos.dot(camDir) > 0.25;
      const show = facing && (m.def.showLabel || id === this.activeId);
      if (!show) { m.label.classList.add('hidden'); continue; }
      v.copy(m.pos).project(this.camera);
      if (!m.size) m.size = { w: m.label.offsetWidth || 80, h: m.label.offsetHeight || 20 };
      // keep the label inside the viewport horizontally
      const x = THREE.MathUtils.clamp((v.x * 0.5 + 0.5) * w, m.size.w / 2 + 4, w - m.size.w / 2 - 4);
      const y = (-v.y * 0.5 + 0.5) * h;
      const box = { l: x - m.size.w / 2, r: x + m.size.w / 2, t: y - m.size.h * 1.35, b: y - m.size.h * 0.35 };
      if (placed.some((p) => box.l < p.r && box.r > p.l && box.t < p.b && box.b > p.t)) { m.label.classList.add('hidden'); continue; }
      placed.push(box);
      m.label.classList.remove('hidden');
      m.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -135%)`;
      m.label.style.zIndex = id === this.activeId ? 2 : 1;
    }
  }
}

function makeMarker({ color = '#3b8cff', size = 1 }) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const s = 0.022 * size;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(s, 24), new THREE.MeshBasicMaterial({ color: c, depthWrite: false }));
  dot.position.z = 0.004;
  const halo = new THREE.Mesh(new THREE.RingGeometry(s * 1.5, s * 2.1, 40),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  halo.position.z = 0.003;
  // Big invisible hit target so markers are easy to tap on a phone.
  const hit = new THREE.Mesh(new THREE.CircleGeometry(s * 3.5, 12), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(dot, halo, hit);
  g.userData.pulse = halo;
  return g;
}

function makeStars() {
  const n = 1800, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 40);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfd4ff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
}

function makeAtmosphere(color) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(c, f * 0.6); }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), mat);
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
