/**
 * Délégataires des aides à la pierre — pont Google Apps Script (même principe que l'Observatoire).
 *
 * Le classeur reste privé. Le site ne lit les données que par le pont (HtmlService + google.script.run),
 * avec une clé d'accès vérifiée ici, côté serveur, à chaque requête.
 *
 * Propriétés du script (Paramètres du projet > Propriétés du script) :
 * - PIERRE_ALLOWED_ORIGINS : adresse(s) du site autorisées, séparées par des virgules,
 *   ex. https://cedriccovarel.github.io  (OBLIGATOIRE)
 * - PIERRE_ACCESS_KEY      : clé d'accès, 16 caractères minimum (OBLIGATOIRE). genererCleAcces() en crée une.
 * - PIERRE_SHEET_GID       : identifiant de l'onglet (« gid= » dans l'URL). Par défaut 1819788546.
 * Lancer configurerSecurite() pour vérifier la configuration.
 */
const PIERRE = {
  VERSION: '1.0',
  DEFAULT_GID: '1819788546',
  MIN_KEY_LENGTH: 16,
  ORIGINS: 'PIERRE_ALLOWED_ORIGINS',
  KEY: 'PIERRE_ACCESS_KEY',
  GID: 'PIERRE_SHEET_GID'
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  // Page du pont : aucune donnée ; chaque lecture passe par pierreBridgeRequest (clé vérifiée).
  if (String(params.bridge || '') === '1') return pierreBridgeHtml_(params);
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'PIERRE', version: PIERRE.VERSION, protected: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Appelée par google.script.run depuis le pont. */
function pierreBridgeRequest(params) {
  try {
    const access = pierreCheckAccess_(params || {});
    if (!access.ok) return { ok: false, authError: true, error: access.error };
    return pierreReadSheet_();
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

function pierreReadSheet_() {
  const gid = pierreProp_(PIERRE.GID) || PIERRE.DEFAULT_GID;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function(s) { return String(s.getSheetId()) === gid; })[0];
  if (!sheet) return { ok: false, error: 'Onglet introuvable (gid ' + gid + ') : renseigne PIERRE_SHEET_GID.' };
  const values = sheet.getDataRange().getDisplayValues();
  const start = values.findIndex(function(r) { return r.some(function(c) { return String(c).trim(); }); });
  if (start < 0) return { ok: true, version: PIERRE.VERSION, sheet: sheet.getName(), headers: [], rows: [] };
  const rows = values.slice(start + 1).filter(function(r) { return String(r[0]).trim(); });
  return { ok: true, version: PIERRE.VERSION, sheet: sheet.getName(), headers: values[start], rows: rows, readAt: new Date().toISOString() };
}

function pierreProp_(name) {
  try { return String(PropertiesService.getScriptProperties().getProperty(name) || '').trim(); } catch (e) { return ''; }
}

function pierreAllowedOrigins_() {
  return pierreProp_(PIERRE.ORIGINS).split(/[\s,;]+/).map(function(v) { return v.replace(/\/+$/, ''); })
    .filter(function(v) { return /^https?:\/\/[^\/\s]+$/i.test(v); });
}

function pierreSafeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Clé obligatoire, jamais journalisée ; 30 échecs en 10 minutes bloquent les essais.
function pierreCheckAccess_(params) {
  const expected = pierreProp_(PIERRE.KEY);
  if (!expected || expected.length < PIERRE.MIN_KEY_LENGTH) return { ok: false, error: 'Clé PIERRE_ACCESS_KEY absente ou trop courte dans Apps Script : lecture refusée.' };
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pierre_fails') || 0);
  if (fails >= 30) return { ok: false, error: 'Trop de tentatives avec une clé invalide : réessaie dans quelques minutes.' };
  if (pierreSafeEqual_(params.key, expected)) return { ok: true };
  cache.put('pierre_fails', String(fails + 1), 600);
  return { ok: false, error: "Clé d'accès absente ou invalide." };
}

function pierreBridgeHtml_(params) {
  const token = String(params.bridgeToken || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  const allowed = JSON.stringify(pierreAllowedOrigins_()).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"></head><body>
<script>
(function(){
  var TOKEN = '${token}', ALLOWED = ${allowed}, PEER = null, PEER_ORIGIN = '';
  // Envois toujours ciblés sur une origine précise, jamais vers « * ».
  function send(t, p, o){ try { if (t && t !== window && o) t.postMessage(p, o); } catch(e) {} }
  function ready(t){ for (var i = 0; i < ALLOWED.length; i++) send(t, {type:'PIERRE_BRIDGE_READY', token:TOKEN}, ALLOWED[i]); }
  window.addEventListener('message', function(event){
    var msg = event.data || {};
    if (!TOKEN || msg.token !== TOKEN) return;
    if (ALLOWED.indexOf(event.origin) < 0) {
      var refusal = ALLOWED.length ? 'Site non autorisé par le script : ' + event.origin + '. Ajoute cette adresse dans PIERRE_ALLOWED_ORIGINS.' : 'PIERRE_ALLOWED_ORIGINS non configurée : le pont refuse de transmettre les données.';
      if (msg.type === 'PIERRE_BRIDGE_HELLO') send(event.source, {type:'PIERRE_BRIDGE_READY', token:TOKEN, refused:true, error:refusal}, event.origin);
      return;
    }
    if (!PEER) { PEER = event.source; PEER_ORIGIN = event.origin; }
    if (event.source !== PEER || event.origin !== PEER_ORIGIN) return;
    if (msg.type === 'PIERRE_BRIDGE_HELLO') return send(PEER, {type:'PIERRE_BRIDGE_READY', token:TOKEN}, PEER_ORIGIN);
    if (msg.type !== 'PIERRE_BRIDGE_REQUEST' || !msg.id) return;
    google.script.run
      .withSuccessHandler(function(payload){ send(PEER, {type:'PIERRE_BRIDGE_RESPONSE', id:msg.id, payload:payload, token:TOKEN}, PEER_ORIGIN); })
      .withFailureHandler(function(err){ send(PEER, {type:'PIERRE_BRIDGE_RESPONSE', id:msg.id, error:String(err && err.message || err), token:TOKEN}, PEER_ORIGIN); })
      .pierreBridgeRequest(msg.params || {});
  });
  try { if (window.top !== window) ready(window.top); } catch(e) {}
  try { ready(parent); } catch(e) {}
})();
</script></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Pont délégataires').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** À lancer une fois depuis l'éditeur : affiche la configuration (jamais la clé). */
function configurerSecurite() {
  const origins = pierreAllowedOrigins_(), key = pierreProp_(PIERRE.KEY), gid = pierreProp_(PIERRE.GID) || PIERRE.DEFAULT_GID;
  Logger.log('Sites autorisés : ' + (origins.length ? origins.join(', ') : 'AUCUN — le pont refusera tout'));
  Logger.log('Clé d’accès : ' + (!key ? 'NON CONFIGURÉE' : key.length < PIERRE.MIN_KEY_LENGTH ? 'TROP COURTE' : 'configurée (' + key.length + ' caractères)'));
  const r = pierreReadSheet_();
  Logger.log('Onglet gid ' + gid + ' : ' + (r.ok ? '« ' + r.sheet + ' », ' + r.rows.length + ' délégataire(s), colonne A = « ' + (r.headers[0] || '') + ' »' : r.error));
}

/** Crée une clé aléatoire de 40 caractères si aucune n'existe ; la lire ensuite dans les propriétés du script. */
function genererCleAcces() {
  // Appelable par google.script.run : ne remplace jamais une clé existante (la changer à la main pour révoquer).
  if (pierreProp_(PIERRE.KEY)) { Logger.log('Une clé existe déjà : modifie-la dans les propriétés du script pour la changer.'); return; }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now())
    .concat(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random()));
  let out = '';
  bytes.slice(0, 40).forEach(function(b) { out += alphabet.charAt(((b % 256) + 256) % alphabet.length); });
  PropertiesService.getScriptProperties().setProperty(PIERRE.KEY, out);
  Logger.log('Clé enregistrée dans PIERRE_ACCESS_KEY (40 caractères) : consulte-la dans les propriétés du script.');
}
