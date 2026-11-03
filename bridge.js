// Client du pont Apps Script (repris de l'Observatoire) : iframe cachée, jeton de session, origine vérifiée.
// La clé n'est envoyée qu'à la fenêtre du pont validée (script.google.com / *.googleusercontent.com), jamais vers « * ».
const TRUSTED = /^https:\/\/(?:script\.google\.com|[a-z0-9-]+\.googleusercontent\.com)$/i;

const randomToken = () => 'b' + Array.from(crypto.getRandomValues(new Uint8Array(18)), x => x.toString(16).padStart(2, '0')).join('');

// Apps Script affiche la page dans des iframes imbriquées : la source doit être l'iframe du pont ou l'un de ses cadres.
function isWithin(source, host) {
  for (let w = source, i = 0; w && i < 6; i++) { if (w === host) return true; let p = null; try { p = w.parent; } catch {} if (!p || p === w) break; w = p; }
  return false;
}

export class AuthError extends Error { constructor(m) { super(m); this.authError = true; } }

export function requestSheet(execUrl, key, timeoutMs = 20000) {
  const token = randomToken();
  const iframe = document.createElement('iframe');
  iframe.title = 'Pont Apps Script'; iframe.setAttribute('aria-hidden', 'true'); iframe.tabIndex = -1;
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0';
  const u = new URL(execUrl); u.searchParams.set('bridge', '1'); u.searchParams.set('bridgeToken', token); u.searchParams.set('_ts', Date.now());
  iframe.src = u.toString(); document.body.appendChild(iframe);
  const host = iframe.contentWindow;
  return new Promise((resolve, reject) => {
    let target = null, origin = '', probe = null;
    const id = randomToken();
    const done = (fn, v) => { clearTimeout(timer); clearInterval(probe); window.removeEventListener('message', onMsg); iframe.remove(); fn(v); };
    const timer = setTimeout(() => done(reject, new Error('Le pont Apps Script ne répond pas (URL de déploiement ou accès « Tout le monde » à vérifier).')), timeoutMs);
    function onMsg(e) {
      const m = e.data || {};
      if (m.token !== token || !TRUSTED.test(String(e.origin)) || !isWithin(e.source, host)) return;
      if (m.type === 'PIERRE_BRIDGE_READY') {
        if (m.refused) return done(reject, new Error(m.error));
        if (target) return;
        target = e.source; origin = e.origin; clearInterval(probe);
        target.postMessage({ type: 'PIERRE_BRIDGE_REQUEST', id, params: { key }, token }, origin);
        return;
      }
      if (m.type === 'PIERRE_BRIDGE_RESPONSE' && m.id === id && e.source === target && e.origin === origin) {
        const p = m.payload || {};
        if (m.error) done(reject, new Error(m.error));
        else if (p.ok === false) done(reject, p.authError ? new AuthError(p.error) : new Error(p.error || 'Erreur Apps Script.'));
        else done(resolve, p);
      }
    }
    window.addEventListener('message', onMsg);
    // Le HELLO ne contient aucun secret : il réveille seulement le pont, dans l'iframe ou ses cadres internes.
    const hello = () => { const send = w => { try { w.postMessage({ type: 'PIERRE_BRIDGE_HELLO', token }, '*'); } catch {} };
      send(host); try { for (let i = 0; i < Math.min(8, host.frames.length); i++) { send(host.frames[i]); for (let j = 0; j < Math.min(4, host.frames[i].frames.length); j++) send(host.frames[i].frames[j]); } } catch {} };
    probe = setInterval(hello, 500); hello();
  });
}
