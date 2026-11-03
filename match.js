// Qui gère les aides à la pierre au point cliqué, d'après le classeur (colonne A = nom, colonne B = « Non » pour une ligne inactive) :
// 1. un délégataire de l'intercommunalité (EPCI) → Oui ;
// 2. sinon la DDT / DDTM du département, si elle figure dans le classeur sans « Non » en colonne B → Non (pas de délégataire) ;
// 3. sinon, forcément le département → Oui (délégation départementale).
// Correspondance EPCI : SIREN (si une colonne SIREN existe), nom identique, puis nom approché (« à vérifier »).

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’'`´]/g, ' ').replace(/\bst(e?)\b/g, 'saint$1').replace(/[^a-z0-9]+/g, ' ').trim();

// Mots génériques des intitulés : ils ne distinguent pas deux territoires.
const GENERIC = new Set(('communaute communautaire agglomeration agglo urbaine urbain metropole metropolitaine eurometropole communes ' +
  'ca cu cc cd cte ct me departement departemental departementale conseil collectivite territoriale ' +
  'ddt ddtm direction territoires mer de du des d la le les l et en sur').split(' '));
export const core = s => norm(s).split(' ').filter(w => w && !GENERIC.has(w));
const isDdt = s => /\bddtm?\b|direction departementale des territoires/.test(norm(s));
const isDept = s => /\b(departement|departemental|departementale|cd)\b/.test(norm(s));
const inactive = row => norm(row[1]) === 'non';

// Ligne DDT / département ↔ département du point : même nom, ou numéro du département dans l'intitulé (« DDT 26 »).
function sameDept(name, dept) {
  const a = core(name).filter(w => !/^\d+$/.test(w) || w.length > 3), b = core(dept.nom);
  if (a.length && a.join(' ') === b.join(' ')) return true;
  return norm(name).split(' ').includes(String(dept.code).toLowerCase());
}

function epciHow(row, name, epci, sirenCol) {
  if (sirenCol >= 0 && String(row[sirenCol] ?? '').replace(/\D/g, '') === String(epci.code)) return 'siren';
  const a = core(name), b = core(epci.nom);
  if (a.length && a.join(' ') === b.join(' ')) return 'exact';
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length && s.some(w => w.length >= 3) && s.every(w => l.includes(w)) ? 'approx' : '';
}

// Résultat : {found, level: 'epci' | 'ddt' | 'departement' | 'inconnu', matches: [{row, name, how, level}]}.
export function findDelegataire({ headers = [], rows = [] }, place) {
  const sirenCol = headers.findIndex(h => /\bsiren\b|code epci/.test(norm(h)));
  const epci = place.epci || null, dept = place.departement || null;
  const named = rows.map(row => ({ row, name: String(row[0] ?? '').trim() })).filter(x => x.name);
  const rank = { siren: 0, exact: 1, approx: 2 };

  const epciMatches = epci ? named.filter(x => !isDdt(x.name) && !isDept(x.name) && !inactive(x.row))
    .map(x => ({ ...x, how: epciHow(x.row, x.name, epci, sirenCol), level: 'epci' })).filter(x => x.how)
    .sort((x, y) => rank[x.how] - rank[y.how]) : [];
  if (epciMatches.length) return { found: true, level: 'epci', matches: epciMatches };
  if (!dept) return { found: false, level: 'inconnu', matches: [] };

  const ddt = named.filter(x => isDdt(x.name) && !inactive(x.row) && sameDept(x.name, dept)).map(x => ({ ...x, how: 'exact', level: 'ddt' }));
  if (ddt.length) return { found: false, level: 'ddt', matches: ddt };

  const dep = named.filter(x => !isDdt(x.name) && isDept(x.name) && sameDept(x.name, dept)).map(x => ({ ...x, how: 'exact', level: 'departement' }));
  return { found: true, level: 'departement', matches: dep };
}
