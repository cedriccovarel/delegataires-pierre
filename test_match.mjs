// node test_match.mjs — correspondance commune → délégataire. Données FICTIVES (noms d'EPCI publics, lignes inventées).
import assert from 'node:assert/strict';
import { findDelegataire, core } from './match.js';
let n = 0; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const sheet = { headers: ['Délégataire', 'Contact', 'Siren'], rows: [
  ['Métropole de Lyon', 'contact fictif A', '200046977'],
  ['CA du Pays Basque', 'contact fictif B', ''],
  ["Communauté d'agglomération Grand Poitiers", 'contact fictif C', ''],
  ['Conseil départemental de la Haute-Savoie', 'contact fictif D', ''],
  ['Saint-Étienne Métropole', 'contact fictif E', ''],
  ['', 'ligne vide', ''],
] };
const place = (code, nom, dcode = '00', dnom = 'Département fictif') => ({ epci: { code, nom }, departement: { code: dcode, nom: dnom } });
const pick = r => r.matches.map(m => [m.name, m.how, m.level]);

eq(core("Communauté d'agglomération du Pays Basque"), ['pays', 'basque'], 'mots génériques retirés');
eq(pick(findDelegataire(sheet, place('200046977', 'Métropole de Lyon'))), [['Métropole de Lyon', 'siren', 'epci']], 'SIREN prioritaire');
eq(pick(findDelegataire(sheet, place('200067106', "Communauté d'agglomération du Pays Basque"))), [['CA du Pays Basque', 'exact', 'epci']], 'CA / Communauté d’agglomération');
eq(pick(findDelegataire(sheet, place('200069854', 'Grand Poitiers Communauté urbaine'))), [["Communauté d'agglomération Grand Poitiers", 'exact', 'epci']], 'intitulé différent, même territoire');
eq(pick(findDelegataire(sheet, place('244200770', 'Saint-Etienne Métropole'))), [['Saint-Étienne Métropole', 'exact', 'epci']], 'accents et tirets');
eq(pick(findDelegataire(sheet, place('200066793', 'CC du Pays de Cruseilles', '74', 'Haute-Savoie'))), [['Conseil départemental de la Haute-Savoie', 'exact', 'departement']], 'délégation départementale');
eq(findDelegataire(sheet, place('200071165', 'CA Valence Romans Agglo', '26', 'Drôme')).found, false, 'aucun délégataire → non');
eq(findDelegataire(sheet, { epci: null, departement: null }).found, false, 'commune sans EPCI ni département');
eq(pick(findDelegataire({ headers: ['Nom'], rows: [['Lyon']] }, place('200046977', 'Métropole de Lyon'))), [['Lyon', 'exact', 'epci']], 'sans colonne SIREN');
eq(pick(findDelegataire({ headers: ['Nom'], rows: [['Pays Basque Sud']] }, place('200067106', 'CA du Pays Basque'))), [['Pays Basque Sud', 'approx', 'epci']], 'nom approché signalé');
eq(findDelegataire({ headers: ['Nom'], rows: [['Pays de Lyon']] }, place('1', 'CC du Pays Lyonnais')).found, false, 'Lyon ≠ Lyonnais');
console.log(`match : ${n} vérifications OK`);
