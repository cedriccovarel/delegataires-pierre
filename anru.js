// Quartiers ANRU (NPNRU) : 480 quartiers d'intérêt national (arrêté du 29/04/2015) et régional (arrêté du 15/01/2019),
// périmètres des quartiers prioritaires 2015. Même fichier et mêmes règles que TotalRecoll (data/npnru.json, données publiques
// ANCT / ANRU, Licence Ouverte 2.0). Anneaux [lat, lon], règle pair-impair (trous et quartiers en plusieurs parties).
export async function loadAnru(url = 'data/npnru.json') {
  const r = await fetch(url); if (!r.ok) throw new Error(`Quartiers ANRU indisponibles (${r.status})`);
  const d = await r.json();
  const quartiers = (d.quartiers || []).map(q => { let s = 90, w = 180, n = -90, e = -180;
    for (const ring of q.rings) for (const [la, lo] of ring) { if (la < s) s = la; if (la > n) n = la; if (lo < w) w = lo; if (lo > e) e = lo; }
    return { ...q, bbox: [s, w, n, e] }; });
  return { quartiers, source: d.source || '' };
}
const inRings = (rings, la, lo) => { let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ai, oi] = r[i], [aj, oj] = r[j];
    if ((ai > la) !== (aj > la) && lo < (oj - oi) * (la - ai) / (aj - ai) + oi) inside = !inside; }
  return inside; };
// Quartier ANRU contenant le point, ou null.
export function anruAt(index, lat, lon) {
  return index?.quartiers.find(q => lat >= q.bbox[0] && lat <= q.bbox[2] && lon >= q.bbox[1] && lon <= q.bbox[3] && inRings(q.rings, lat, lon)) || null;
}
