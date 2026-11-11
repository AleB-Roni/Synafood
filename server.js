// Synafood-Server: liefert die Web-App aus und teilt die Daten zwischen allen Handys.
// Keine Abhängigkeiten, nur Node.js 18+.  Start:  node server.js
// Umgebungsvariablen: PORT (Standard 8080), DATA_DIR (Standard ./data), APP_PASSWORD (optional, Zugangsschutz),
//   ADMIN_PASSWORD (optional, nur wer es kennt, darf Personen anlegen/entfernen)
// KI-Scanner (optional): LLM_URL (z. B. http://192.168.1.50:11434), LLM_MODEL (z. B. qwen3-vl:8b),
//   LLM_API (auto | ollama | openai), LLM_API_KEY (falls nötig)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 8080;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
const PASSWORD = process.env.APP_PASSWORD || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
fs.mkdirSync(path.join(DATA, 'img'), {recursive: true});

// Gleiche Logik wie im Browser: aus index.html übernehmen, damit beide nie auseinanderlaufen.
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const reducerSrc = html.match(/\/\*REDUCER-START\*\/([\s\S]*?)\/\*REDUCER-END\*\//)[1];
const {applyOp} = new Function(reducerSrc + '; return {applyOp, nameKey};')();
const llmSrc = html.match(/\/\*LLM-START\*\/([\s\S]*?)\/\*LLM-END\*\//)[1];
const {llmScan} = new Function(llmSrc + '; return {llmScan};')();
const LLM = {url: process.env.LLM_URL || '', model: process.env.LLM_MODEL || 'qwen3-vl:8b', api: process.env.LLM_API || 'auto', key: (process.env.LLM_API_KEY || '').replace(/^bearer\s+/i, '')};

const STATE_FILE = path.join(DATA, 'state.json');
let db = {version: 1, state: {orders: {}, claims: {}, paid: {}, users: []}};
try { db = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, STATE_FILE);
  }, 200);
}

const OPS = new Set(['upsertOrder', 'deleteOrder', 'setClaim', 'setPaid', 'addUser', 'removeUser']);
const ADMIN_OPS = new Set(['addUser', 'removeUser']);
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {'content-type': type, 'cache-control': 'no-store'});
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function authorized(req) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const pass = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  const a = Buffer.from(pass), b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) {
      res.writeHead(401, {'www-authenticate': 'Basic realm="Synafood", charset="UTF-8"'});
      return res.end('Passwort erforderlich');
    }
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (p === '/api/state' && req.method === 'GET') {
      if (url.searchParams.get('since') === String(db.version)) { res.writeHead(304); return res.end(); }
      return send(res, 200, db);
    }
    if (p === '/api/op' && req.method === 'POST') {
      const op = JSON.parse(await readBody(req, 1_000_000));
      if (!op || !OPS.has(op.type)) return send(res, 400, {error: 'unbekannte Aktion'});
      if (ADMIN_OPS.has(op.type) && ADMIN_PASSWORD) {
        const a = Buffer.from(String(req.headers['x-admin-password'] || '')), b = Buffer.from(ADMIN_PASSWORD);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return send(res, 403, {error: 'Admin-Passwort falsch'});
      }
      applyOp(db.state, op); db.version++; persist();
      return send(res, 200, db);
    }
    if (p === '/api/config' && req.method === 'GET') return send(res, 200, {llm: LLM.url ? {model: LLM.model} : null, adminProtected: !!ADMIN_PASSWORD});
    if (p === '/api/scan' && req.method === 'POST') {
      if (!LLM.url) return send(res, 400, {error: 'Kein KI-Modell eingerichtet (LLM_URL fehlt)'});
      const {images} = JSON.parse(await readBody(req, 20_000_000));
      if (!Array.isArray(images) || !images.length || images.length > 4 || !images.every(s => typeof s === 'string' && s.startsWith('data:image/'))) return send(res, 400, {error: 'ungültige Bilder'});
      try {
        const t0 = Date.now();
        const text = await llmScan(LLM, images, AbortSignal.timeout(240000));
        console.log('KI-Scan fertig in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
        return send(res, 200, {text});
      } catch (e) {
        console.error('KI-Scan fehlgeschlagen:', e.message || e);
        return send(res, 502, {error: e.name === 'TimeoutError' ? 'Zeitüberschreitung beim Modell' : 'Modell nicht erreichbar oder Fehler: ' + String(e.message || e).slice(0, 160)});
      }
    }
    const img = p.match(/^\/api\/img\/([A-Za-z0-9_-]{1,64})$/);
    if (img) {
      const file = path.join(DATA, 'img', img[1] + '.json');
      if (req.method === 'GET') return fs.existsSync(file) ? send(res, 200, fs.readFileSync(file)) : send(res, 200, []);
      if (req.method === 'PUT') {
        const body = await readBody(req, 6_000_000);
        const arr = JSON.parse(body);
        if (!Array.isArray(arr) || !arr.every(s => typeof s === 'string' && s.startsWith('data:image/'))) return send(res, 400, {error: 'ungültiges Bild'});
        fs.writeFileSync(file, body); return send(res, 200, {ok: true});
      }
      if (req.method === 'DELETE') { fs.rmSync(file, {force: true}); return send(res, 200, {ok: true}); }
    }

    // Statische Dateien
    let rel = decodeURIComponent(p === '/' ? '/index.html' : p);
    const file = path.normalize(path.join(PUB, rel));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Nicht gefunden', 'text/plain');
    res.writeHead(200, {'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': rel === '/sw.js' || rel === '/index.html' ? 'no-cache' : 'public, max-age=86400'});
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 400, {error: String(e.message || e)});
  }
});
server.requestTimeout = 300000;
server.listen(PORT, () => console.log('Synafood läuft (Port im Container: ' + PORT + ', von außen erreichbar über den in Docker freigegebenen Host-Port)' + (PASSWORD ? ' (mit Passwort)' : '') + (LLM.url ? ' · KI-Scanner: ' + LLM.model + ' @ ' + LLM.url : '')));
