// Easter egg (temporaire) : faux écran de chargement de 24 s après saisie de la clé.
// Les photos sont chiffrées (openssl enc -aes-256-cbc -pbkdf2 -iter 150000 -md sha256) avec la clé d'accès :
// sans la bonne clé, rien ne s'affiche et le site se comporte normalement.
const ITER = 150000;
const PHOTOS = ['1.bin', '2.bin', '3.bin', '4.bin', '5.bin'];

async function decrypt(buf, key) {
  const b = new Uint8Array(buf);
  if (new TextDecoder().decode(b.subarray(0, 8)) !== 'Salted__') throw new Error('format');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b.subarray(8, 16), iterations: ITER, hash: 'SHA-256' }, base, 384));
  const k = await crypto.subtle.importKey('raw', bits.subarray(0, 32), 'AES-CBC', false, ['decrypt']);
  const out = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: bits.subarray(32) }, k, b.subarray(16)));
  if (out[0] !== 0xFF || out[1] !== 0xD8) throw new Error('clé');
  return URL.createObjectURL(new Blob([out], { type: 'image/jpeg' }));
}

// Renvoie les URL des photos déchiffrées, ou null (mauvaise clé, fichier absent…).
export async function prepareEgg(key) {
  try {
    return await Promise.all(PHOTOS.map(async f => {
      const r = await fetch(new URL(f, import.meta.url)); if (!r.ok) throw new Error(r.status);
      return decrypt(await r.arrayBuffer(), key);
    }));
  } catch { return null; }
}

const STEPS = [
  'Initialisation du modem 56k… 📞',
  'Connexion à la DRIHL par Minitel…',
  'Dépoussiérage des conventions de délégation…',
  'Barattage du beurre de la délégation 🧈…',
  'Calcul des aides à la pierre (et des amandes fumées)…',
  'Ouverture du crémant réglementaire 🍾',
  'Vérification RE2020 du gobelet en carton…',
  'Fonte du chocolat départemental 🍫…',
  'Gonflage des muscles gras 💪…',
  'Presque fini (promis juré) …',
  'Chargement des derniers 1 %…',
  'Toujours les derniers 1 %…',
];
// Une légende par photo, dans l'ordre de PHOTOS.
const CAPTIONS = ['Réunion stratégique 🥜', 'Validation du référentiel 🥂', 'Audit du beurre réglementaire 🧈', 'Muscle gras certifié 💪', 'Fondue de la délégation 🍫'];
const FX = ['fx-spin', 'fx-zoom', 'fx-flip', 'fx-slide'];
const FLOAT = ['✨', '⭐', '💖', '🍾', '🥂', '🥜', '🏠', '🌈', '💾', '🎉'];

// Courbe de progression volontairement absurde : rapide, bloquée, puis 99 % interminable.
function pct(t) {
  const P = [[0, 0], [.12, 37], [.33, 41], [.42, 68], [.5, 69], [.62, 88], [.72, 99], [.97, 99], [1, 100]];
  for (let i = 1; i < P.length; i++) if (t <= P[i][0]) { const [a, pa] = P[i - 1], [b, pb] = P[i]; return pa + (pb - pa) * (t - a) / (b - a); }
  return 100;
}

export function playEgg(urls, duration = 24000) {
  if (!document.querySelector('link[data-egg]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.egg = '1'; l.href = new URL('egg.css?v=2', import.meta.url); document.head.append(l);
  }
  const el = document.createElement('div');
  el.className = 'egg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Chargement des délégataires');
  el.innerHTML = `
    <div class="egg-rays"></div><div class="egg-float"></div>
    <div class="egg-construct">🚧 SITE EN CONSTRUCTION 🚧</div>
    <h1 class="egg-title" data-t="CHARGEMENT DES DÉLÉGATAIRES">CHARGEMENT DES DÉLÉGATAIRES</h1>
    <div class="egg-stage"><figure class="egg-polaroid"><div class="egg-photo"><img alt=""><img alt=""></div><figcaption></figcaption></figure>
      <div class="egg-badge">100 %<br>OFFICIEL</div></div>
    <div class="egg-win"><div class="egg-winbar"><span>⏳ Delegataires.exe</span><span class="egg-btns"><i>_</i><i>□</i><i>×</i></span></div>
      <div class="egg-winbody"><p class="egg-msg" role="status"></p><div class="egg-bar"><div class="egg-fill"></div></div>
      <div class="egg-meta"><span class="egg-pct">0 %</span><span class="egg-eta"></span></div></div></div>
    <div class="egg-counter">Vous êtes le visiteur n° <b>000042</b></div>
    <div class="egg-marquee"><span>★ Bienvenue sur le site officiel des délégataires à la pierre ★ Meilleure résolution : 800×600 ★ Site optimisé pour Netscape Navigator 4 ★ Ne débranchez pas le téléphone ★ Signez notre livre d’or ★</span></div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('on'));

  const imgs = el.querySelectorAll('.egg-photo img'), cap = el.querySelector('figcaption'), pol = el.querySelector('.egg-polaroid');
  const msg = el.querySelector('.egg-msg'), fill = el.querySelector('.egg-fill'), pctEl = el.querySelector('.egg-pct'), eta = el.querySelector('.egg-eta');
  const float = el.querySelector('.egg-float');
  let slide = -1, front = 0;
  const next = () => {
    slide++; front = 1 - front;
    const img = imgs[front]; img.src = urls[slide % urls.length];
    imgs.forEach((im, i) => { im.className = i === front ? 'show ' + FX[slide % FX.length] : 'hide'; });
    cap.textContent = CAPTIONS[slide % urls.length] || '';
    pol.style.setProperty('--tilt', `${(slide % 2 ? 1 : -1) * (2 + (slide % 3) * 1.5)}deg`);
  };
  next();
  const timers = [setInterval(next, 3000)];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span'); s.textContent = FLOAT[i % FLOAT.length];
    s.style.cssText = `left:${(i * 53) % 100}%;animation-delay:${-(i * 1.37) % 9}s;animation-duration:${7 + (i % 5)}s;font-size:${18 + (i % 4) * 8}px`;
    float.append(s);
  }
  const sparkle = e => { const s = document.createElement('i'); s.className = 'egg-sparkle'; s.textContent = '✦';
    s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; el.append(s); setTimeout(() => s.remove(), 800); };
  el.addEventListener('pointermove', sparkle);

  const t0 = performance.now(); let raf, finish, stopped = false;
  const tick = () => {
    const t = Math.min(1, (performance.now() - t0) / duration), p = pct(t);
    fill.style.width = p + '%'; pctEl.textContent = Math.floor(p) + ' %';
    msg.textContent = t >= .99 ? '✨ TADAAA ✨' : STEPS[Math.min(STEPS.length - 1, Math.floor(t * STEPS.length))];
    const left = Math.ceil((1 - t) * duration / 1000);
    eta.textContent = t >= .99 ? 'Terminé !' : t > .72 ? 'Temps restant : bientôt' : `Temps restant : ${[3, 47, 12, 2][Math.floor(t * 8) % 4] * left} min`;
    if (t < 1) raf = requestAnimationFrame(tick); else end();
  };
  raf = requestAnimationFrame(tick);

  const cleanup = () => { stopped = true; timers.forEach(clearInterval); cancelAnimationFrame(raf); el.classList.remove('on'); el.classList.add('off');
    setTimeout(() => { el.remove(); urls.forEach(u => URL.revokeObjectURL(u)); }, 700); };
  function end() {
    if (stopped) return;
    el.classList.add('confetti'); for (let i = 0; i < 80; i++) { const c = document.createElement('i'); c.className = 'egg-conf';
      c.style.cssText = `left:${Math.random() * 100}%;background:hsl(${Math.random() * 360} 90% 60%);animation-delay:${Math.random() * .3}s;transform:rotate(${Math.random() * 360}deg)`; el.append(c); }
    setTimeout(() => { cleanup(); finish(); }, 900);
  }
  const done = new Promise(r => { finish = r; });
  return { done, abort: () => { if (!stopped) { cleanup(); finish(); } } };
}
