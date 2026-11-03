// Correspondance commune → délégataire des aides à la pierre (colonne A du classeur).
// Ordre de confiance : SIREN de l'EPCI (si une colonne SIREN existe), nom identique, puis nom approché (« à vérifier »).

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’'`´]/g, ' ').replace(/\bst(e?)\b/g, 'saint$1').replace(/[^a-z0-9]+/g, ' ').trim();

// Mots génériques des intitulés d'EPCI ou de département : ils ne distinguent pas deux territoires.
const GENERIC = new Set(('communaute communautaire agglomeration agglo urbaine urbain metropole metropolitaine eurometropole communes ' +
  'ca cu cc cd cte ct me departement departemental departementale conseil collectivite territoriale de du des d la le les l et en sur').split(' '));
export const core = s => norm(s).split(' ').filter(w => w && !GENERIC.has(w));
const isDept = s => /\b(departement|departemental|departementale|cd)\b/.test(norm(s));

// headers : ligne d'en-tête ; rows : lignes de données. Colonne A = nom du délégataire.
export function findDelegataire({ headers = [], rows = [] }, place) {
  const sirenCol = headers.findIndex(h => /\bsiren\b|code epci/.test(norm(h)));
  const epci = place.epci || null, dept = place.departement || null;
  const matches = [];
  for (const row of rows) {
    const name = String(row[0] ?? '').trim();
    if (!name) continue;
    const dpt = isDept(name), target = dpt ? dept : epci;
    if (!target) continue;
    let how = '';
    if (!dpt && sirenCol >= 0 && String(row[sirenCol] ?? '').replace(/\D/g, '') === String(epci.code)) how = 'siren';
    else {
      const a = core(name), b = core(target.nom);
      const same = a.length && a.join(' ') === b.join(' ');
      const [s, l] = a.length <= b.length ? [a, b] : [b, a];
      if (same) how = 'exact';
      else if (s.length && s.some(w => w.length >= 3) && s.every(w => l.includes(w))) how = 'approx';
    }
    if (how) matches.push({ row, name, how, level: dpt ? 'departement' : 'epci' });
  }
  const rank = { siren: 0, exact: 1, approx: 2 };
  matches.sort((x, y) => rank[x.how] - rank[y.how]);
  return { found: matches.length > 0, matches };
}
