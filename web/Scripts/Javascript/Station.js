// Live link to the field rover (Arduino + ESP32).
// Every source delivers the same message: one JSON object such as
//   {"temp":24.1,"uv":6.2,"pm25":14,"solar":410,"soil":22,"tilt":3.4,"vib":0.08,"slip":5}
// Missing keys are fine. Sources: MQTT over WebSocket (ESP32 on Wi-Fi), USB serial
// (Arduino or ESP32 plugged into this computer, Chrome/Edge) and a built-in demo.

const HISTORY = 60;          // points kept per measure (sparklines)
const STALE_MS = 10000;      // no message for this long -> "waiting"

export class Station {
  constructor(measureIds) {
    this.ids = measureIds;
    this.mode = 'off';           // off | demo | mqtt | usb
    this.status = 'off';         // off | connecting | live | waiting | error
    this.detail = '';
    this.latest = {};
    this.history = Object.fromEntries(measureIds.map((id) => [id, []]));
    this.lastAt = 0;
    this.onChange = () => {};
    this._stop = null;
    setInterval(() => this._checkStale(), 2000);
  }

  get supportsUsb() { return 'serial' in navigator; }

  async startDemo() {
    await this.stop();
    this._set('demo', 'live', 'Simulated readings with a dust storm every minute');
    let t = 0;
    const tick = () => {
      t += 1;
      const storm = Math.max(0, Math.sin((t % 60) / 60 * Math.PI * 2 - 1.2)); // 0..1
      const n = (a) => (Math.random() - 0.5) * a;
      this.ingest({
        temp: 27 + 2 * Math.sin(t / 40) + n(0.4),
        uv: Math.max(0, 7.5 * (1 - 0.8 * storm) + n(0.3)),
        pm25: 12 + 260 * storm * storm + n(4),
        solar: Math.max(0, 520 * (1 - 0.75 * storm) + n(15)),
        soil: 18 + n(1),
        tilt: 4 + 6 * Math.abs(Math.sin(t / 7)) + n(0.8),
        vib: 0.05 + 0.12 * Math.abs(Math.sin(t / 3)) + n(0.02),
        slip: 6 + 14 * storm + n(2),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    this._stop = () => clearInterval(id);
  }

  async connectMqtt(broker, topic) {
    await this.stop();
    this._set('mqtt', 'connecting', broker);
    let client;
    try {
      const { default: mqtt } = await import('../../lib/mqtt/mqtt.esm.js');
      client = mqtt.connect(broker, { clientId: 'ih-web-' + Math.random().toString(16).slice(2, 10), reconnectPeriod: 4000, connectTimeout: 8000 });
    } catch (err) {
      this._set('mqtt', 'error', 'Could not load MQTT: ' + err.message);
      return;
    }
    client.on('connect', () => {
      client.subscribe(topic, (err) => {
        if (err) this._set('mqtt', 'error', 'Subscribe failed: ' + err.message);
        else this._set('mqtt', 'waiting', `Connected. Waiting for ${topic}`);
      });
    });
    client.on('message', (_t, payload) => this._parse(payload.toString()));
    client.on('reconnect', () => this._set('mqtt', 'connecting', `Cannot reach ${broker}. Retrying…`));
    client.on('error', (err) => this._set('mqtt', 'error', err.message));
    this._stop = () => new Promise((res) => client.end(true, {}, res));
  }

  async connectUsb(baud = 115200) {
    if (!this.supportsUsb) { this._set('usb', 'error', 'USB needs Chrome or Edge on a computer'); return; }
    let port;
    try {
      port = await navigator.serial.requestPort();   // must come from a click
    } catch { return; }                               // user closed the picker
    await this.stop();
    this._set('usb', 'connecting', 'Opening port…');
    try {
      await port.open({ baudRate: baud });
    } catch (err) {
      this._set('usb', 'error', 'Could not open port: ' + err.message);
      return;
    }
    this._set('usb', 'waiting', `Port open at ${baud} baud`);
    let reading = true;
    const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
    this._stop = async () => {
      reading = false;
      try { await reader.cancel(); } catch { /* already closed */ }
      try { await port.close(); } catch { /* already closed */ }
    };
    let buf = '';
    (async () => {
      try {
        while (reading) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            this._parse(buf.slice(0, i));
            buf = buf.slice(i + 1);
          }
          if (buf.length > 4096) buf = '';
        }
      } catch (err) {
        if (reading) this._set('usb', 'error', 'USB disconnected');
      }
    })();
  }

  async stop() {
    const s = this._stop;
    this._stop = null;
    if (s) await s();
    this._set('off', 'off', '');
  }

  ingest(obj) {
    let any = false;
    for (const id of this.ids) {
      const v = Number(obj[id]);
      if (obj[id] == null || !Number.isFinite(v)) continue;
      this.latest[id] = v;
      const h = this.history[id];
      h.push(v);
      if (h.length > HISTORY) h.shift();
      any = true;
    }
    if (!any) return;
    this.lastAt = Date.now();
    if (this.status !== 'live') this._set(this.mode, 'live', this.mode === 'demo' ? this.detail : 'Receiving data');
    else this.onChange();
  }

  clear() {
    this.latest = {};
    for (const id of this.ids) this.history[id] = [];
    this.lastAt = 0;
  }

  _parse(line) {
    line = line.trim();
    if (!line.startsWith('{')) return;     // ignore debug prints
    try { this.ingest(JSON.parse(line)); } catch { /* partial line */ }
  }

  _checkStale() {
    if (this.status === 'live' && this.mode !== 'demo' && Date.now() - this.lastAt > STALE_MS) {
      this._set(this.mode, 'waiting', 'No data in the last 10 s');
    }
  }

  _set(mode, status, detail) {
    const modeChanged = mode !== this.mode && mode !== 'off';
    this.mode = mode;
    this.status = status;
    this.detail = detail;
    if (modeChanged) this.clear();
    this.onChange();
  }
}
