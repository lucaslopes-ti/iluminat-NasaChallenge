// Live link to the field rover (Arduino Uno on the USB cable).
// Every source delivers the same message: one JSON object such as
//   {"temp":26.3,"umid":53.2,"dist":85,"luz":334}        (firmware/carrinho_motores)
//   {"temp":24.1,"uv":6.2,"pm25":14,"solar":410,"soil":22,"tilt":3.4,"vib":0.08,"slip":5}
// Missing keys are fine. Sources: MQTT over WebSocket (published by the computer the
// Arduino is plugged into: firmware/controle_carrinho.py or ponte_serial_mqtt.py),
// or USB serial straight into this page (Chrome/Edge). No simulated data.

const HISTORY = 60;          // points kept per measure (sparklines)
const STALE_MS = 10000;      // no message for this long -> "waiting"

export class Station {
  constructor(measureIds) {
    this.ids = measureIds;
    this.mode = 'off';           // off | mqtt | usb
    this.status = 'off';         // off | connecting | live | waiting | error
    this.detail = '';
    this.latest = {};
    this.history = Object.fromEntries(measureIds.map((id) => [id, []]));
    this.lastAt = 0;
    this.log = [];               // every reading of this session, for the CSV download
    this.solarMax = null;        // brightest solar reading so far = "clear sky" reference
    this.onChange = () => {};
    this._stop = null;
    setInterval(() => this._checkStale(), 2000);
  }

  get supportsUsb() { return 'serial' in navigator; }

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
    const row = { time: new Date(this.lastAt).toISOString() };
    for (const id of this.ids) row[id] = obj[id] != null && Number.isFinite(Number(obj[id])) ? Number(obj[id]) : '';
    this.log.push(row);
    if (this.log.length > 20000) this.log.shift();
    if (Number.isFinite(this.latest.solar) && obj.solar != null) this.solarMax = Math.max(this.solarMax ?? 0, this.latest.solar);
    if (this.status !== 'live') this._set(this.mode, 'live', 'Receiving data');
    else this.onChange();
  }

  /** Solar power now as a fraction of the brightest reading (1 = clear), or null. */
  get solarFraction() {
    if (!Number.isFinite(this.latest.solar) || !this.solarMax) return null;
    return Math.max(0, Math.min(1, this.latest.solar / this.solarMax));
  }

  csv() {
    const cols = ['time', ...this.ids];
    return [cols.join(','), ...this.log.map((r) => cols.map((c) => (typeof r[c] === 'number' ? +r[c].toFixed(3) : r[c])).join(','))].join('\n');
  }

  clear() {
    this.log = [];
    this.solarMax = null;
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
    if (this.status === 'live' && Date.now() - this.lastAt > STALE_MS) {
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
