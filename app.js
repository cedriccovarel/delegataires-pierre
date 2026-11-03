import { EXEC_URL } from './config.js?v=1.1.0';
import { requestSheet } from './bridge.js?v=1.0.0';
import { findDelegataire, profilesAt, isIdf } from './match.js?v=1.2.0';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const S = { key: '', sheet: null, loading: false, marker: null, seq: 0, last: null };

/* ---------- Carte : Plan IGN (Géoplateforme), jusqu'au niveau de la rue ---------- */
const map = L.map('map', { zoomControl: false, minZoom: 5, maxZoom: 19 }).setView([46.6, 2.4], 6);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  { maxZoom: 19, attribution: '© <a href="https://www.ign.fr/">IGN</a> – Géoplateforme' }).addTo(map);
// Clic droit (appui long sur mobile) : analyse du point.
map.on('contextmenu', e => analyze(e.latlng.lat, e.latlng.lng));

/* ---------- Données : classeur privé lu par le pont Apps Script ---------- */
function setDataState(text, kind = '') { const el = $('dataState'); el.textContent = text; el.className = 'data ' + kind; }
function askKey(msg = '') { if (!EXEC_URL) return; $('keyErr').textContent = msg; if (!$('keyDlg').open) $('keyDlg').showModal(); $('keyInput').focus(); }

async function loadSheet() {
  S.loading = true; setDataState('Chargement des délégataires…'); $('keyOk').disabled = true;
  try {
    const r = await requestSheet(EXEC_URL, S.key);
    S.sheet = { headers: r.headers || [], rows: r.rows || [] };
    setDataState(`${S.sheet.rows.length} délégataires chargés`, 'ok'); $('keyDlg').close();
    if (S.last) analyze(...S.last);
  } catch (err) {
    S.key = ''; setDataState('Délégataires non chargés', 'warn'); askKey(err.message);
  } finally { S.loading = false; $('keyOk').disabled = false; }
}
$('keyForm').addEventListener('submit', e => { e.preventDefault(); S.key = $('keyInput').value.trim(); $('keyInput').value = ''; loadSheet(); });
$('keyLater').onclick = () => $('keyDlg').close();
if (EXEC_URL) { setDataState('Délégataires non chargés', 'warn'); askKey(); }
else setDataState('Source Google Sheet non configurée', 'warn');

/* ---------- Analyse d'un point ---------- */
async function getJson(url) { const r = await fetch(url); if (!r.ok) throw new Error(`Service indisponible (${r.status})`); return r.json(); }
// Découpage administratif IGN (ADMIN EXPRESS) au point cliqué, sans géométrie : commune, EPCI, département.
async function adminAt(layer, props, lat, lon) {
  const u = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ADMINEXPRESS-COG.LATEST:${layer}&outputFormat=application/json&count=1&propertyName=${props}&CQL_FILTER=INTERSECTS(geometrie,POINT(${lat} ${lon}))`;
  return (await getJson(u)).features?.[0]?.properties || null;
}

async function analyze(lat, lon, label = '') {
  const seq = ++S.seq; S.last = [lat, lon, label];
  if (S.marker) S.marker.setLatLng([lat, lon]); else S.marker = L.marker([lat, lon], { keyboard: false }).addTo(map);
  openSide('<p class="wait">Recherche de la commune…</p>');
  let commune, address = label;
  try {
    const [c, e, d, rev] = await Promise.all([
      adminAt('commune', 'nom_officiel,code_insee,code_insee_de_la_region', lat, lon),
      adminAt('epci', 'nom_officiel,code_siren', lat, lon),
      adminAt('departement', 'nom_officiel,code_insee', lat, lon),
      label ? null : getJson(`https://data.geopf.fr/geocodage/reverse?lon=${lon}&lat=${lat}&limit=1`).catch(() => null)
    ]);
    commune = c && { nom: c.nom_officiel, code: c.code_insee, region: c.code_insee_de_la_region, epci: e && { nom: e.nom_officiel, code: e.code_siren }, departement: d && { nom: d.nom_officiel, code: d.code_insee } };
    address = address || rev?.features?.[0]?.properties?.label || '';
  } catch (err) { if (seq === S.seq) openSide(`<p class="err">${esc(err.message)}</p>`); return; }
  if (seq !== S.seq) return;
  if (!commune) return openSide(`<section class="card manager"><span class="kicker">Aides à la pierre</span><b>Hors de France</b><p>Aucune commune française à cet endroit.</p></section>`);
  openSide(render(commune, address));
}

function render(c, address) {
  const where = `<dl class="where">
    ${address ? `<dt>Adresse</dt><dd>${esc(address)}</dd>` : ''}
    <dt>Commune</dt><dd>${esc(c.nom)} <small>INSEE ${esc(c.code)}</small></dd>
    <dt>Intercommunalité</dt><dd>${c.epci ? `${esc(c.epci.nom)} <small>SIREN ${esc(c.epci.code)}</small>` : 'aucune'}</dd>
    <dt>Département</dt><dd>${c.departement ? `${esc(c.departement.nom)} (${esc(c.departement.code)})` : '—'}</dd></dl>`;
  const profiles = profilesAt(c);
  const extra = `${isIdf(c) ? `<section class="card drihl"><span class="kicker">Marges</span><b>DRIHL</b><p>En Île-de-France, les marges sont gérées par la DRIHL (Direction régionale et interdépartementale de l’hébergement et du logement).</p></section>` : ''}
    <section class="card profile"><span class="kicker">Profil Prestaterre</span>${profiles.length ? profiles.map(p => `<b>${esc(p.name)}</b><p>${esc(p.territory)}</p>`).join('') : '<p>Aucun profil territorial Prestaterre à cet endroit.</p>'}</section>`;
  if (!S.sheet) return `<section class="card manager"><span class="kicker">Aides à la pierre</span><b>Données non chargées</b><p>Saisis la clé d’accès pour savoir qui gère les aides à la pierre ici.</p>
    ${EXEC_URL ? '<button type="button" class="btn" data-ask-key>Saisir la clé</button>' : ''}</section>${extra}${where}`;
  const res = findDelegataire(S.sheet, { epci: c.epci, departement: c.departement });
  const HOW = { siren: 'SIREN de l’intercommunalité identique', exact: 'même nom que l’intercommunalité', approx: 'nom approché : à vérifier' };
  const details = ms => ms.map(m => { const dl = S.sheet.headers.map((h, i) => i && String(m.row[i] ?? '').trim() ? `<dt>${esc(h || `Colonne ${i + 1}`)}</dt><dd>${esc(m.row[i])}</dd>` : '').join('');
    return dl ? `<dl class="deleg">${ms.length > 1 ? `<dt class="full">${esc(m.name)}</dt>` : ''}${dl}</dl>` : ''; }).join('');
  const card = (title, sub, ms, warn = '') => `<section class="card manager"><span class="kicker">Gère les aides à la pierre</span><b>${esc(title)}</b><p>${sub}</p>${warn}</section>${details(ms)}`;
  let body;
  if (res.level === 'inconnu') body = card('Indéterminé', 'Ni intercommunalité ni département trouvé pour ce point.', []);
  else if (res.level === 'ddt') body = card(res.matches[0].name, 'État : pas de délégataire sur ce territoire.', res.matches);
  else if (res.level === 'departement') body = card(res.matches[0]?.name || `Département : ${c.departement.nom}`, `Délégation départementale (${esc(c.departement.code)}) : aucun délégataire intercommunal, pas de DDT active dans le tableur.`, res.matches);
  else { const approx = res.matches.every(m => m.how === 'approx');
    body = card(res.matches.map(m => m.name).join(' · '), `Délégataire intercommunal · ${HOW[res.matches[0].how]}`, res.matches, approx ? '<p class="warn">Correspondance de nom approchée : à vérifier dans le tableur.</p>' : ''); }
  return `${body}${extra}${where}`;
}

function openSide(html) { $('sideBody').innerHTML = html; $('side').hidden = false; document.body.classList.add('side-open'); }
$('closeSide').onclick = () => { $('side').hidden = true; document.body.classList.remove('side-open'); };
$('side').addEventListener('click', e => { if (e.target.closest('[data-ask-key]')) askKey(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('side').hidden && !$('keyDlg').open) $('closeSide').click(); });

/* ---------- Champ adresse (géocodage Géoplateforme) ---------- */
const q = $('q'), sugg = $('sugg'); let items = [], active = -1, timer = null, qseq = 0;
function showSugg(list) {
  items = list; active = -1; q.setAttribute('aria-expanded', String(!!list.length)); sugg.hidden = !list.length;
  sugg.innerHTML = list.map((f, i) => `<li role="option" id="s${i}" data-i="${i}">${esc(f.properties.label)}<small>${esc(f.properties.context || '')}</small></li>`).join('');
}
function pick(f) {
  const [lon, lat] = f.geometry.coordinates; const t = f.properties.type;
  q.value = f.properties.label; showSugg([]);
  map.flyTo([lat, lon], t === 'housenumber' ? 18 : t === 'street' ? 17 : 14, { duration: .8 });
  analyze(lat, lon, f.properties.label);
}
q.addEventListener('input', () => {
  clearTimeout(timer); const text = q.value.trim(); if (text.length < 3) return showSugg([]);
  timer = setTimeout(async () => { const n = ++qseq;
    try { const r = await getJson(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(text)}&limit=6&autocomplete=1`); if (n === qseq) showSugg(r.features || []); }
    catch { if (n === qseq) showSugg([]); } }, 250);
});
q.addEventListener('keydown', e => {
  if (!items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
    sugg.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === active))); q.setAttribute('aria-activedescendant', 's' + active); }
  if (e.key === 'Escape') showSugg([]);
});
sugg.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(items[+li.dataset.i]); } });
$('searchForm').addEventListener('submit', async e => { e.preventDefault();
  if (items.length) return pick(items[Math.max(active, 0)]);
  const text = q.value.trim(); if (text.length < 3) return;
  try { const r = await getJson(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(text)}&limit=1`); if (r.features?.[0]) pick(r.features[0]); else openSide('<p class="err">Adresse introuvable.</p>'); }
  catch (err) { openSide(`<p class="err">${esc(err.message)}</p>`); }
});
q.addEventListener('blur', () => setTimeout(() => showSugg([]), 150));
