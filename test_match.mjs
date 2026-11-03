// node test_match.mjs — qui gère les aides à la pierre au point cliqué. Données FICTIVES (noms publics, lignes inventées).
import assert from 'node:assert/strict';
import { findDelegataire, core } from './match.js';
let n = 0; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const sheet = { headers: ['Délégataire', 'Actif', 'Contact', 'Siren'], rows: [
  ['Métropole de Lyon', 'Oui', 'contact fictif A', '200046977'],
  ['CA du Pays Basque', 'Oui', 'contact fictif B', ''],
  ["Communauté d'agglomération Grand Poitiers", '', 'contact fictif C', ''],
  ['Saint-Étienne Métropole', 'Oui', 'contact fictif E', ''],
  ['CA Valence Romans Agglo', 'Non', 'ligne inactive', ''],
  ['DDT de la Drôme', 'Oui', 'contact DDT fictif', ''],
  ['DDTM 64', 'Oui', 'contact DDTM fictif', ''],
  ['DDT de la Haute-Savoie', 'Non', 'DDT non compétente', ''],
  ['Conseil départemental de la Haute-Savoie', '', 'contact CD fictif', ''],
  ['', 'ligne vide', '', ''],
] };
const place = (code, nom, dcode = '00', dnom = 'Département fictif') => ({ epci: { code, nom }, departement: { code: dcode, nom: dnom } });
const pick = r => [r.found, r.level, r.matches.map(m => [m.name, m.how])];

eq(core("Communauté d'agglomération du Pays Basque"), ['pays', 'basque'], 'mots génériques retirés');
// 1. Délégataire intercommunal.
eq(pick(findDelegataire(sheet, place('200046977', 'Métropole de Lyon', '69', 'Rhône'))), [true, 'epci', [['Métropole de Lyon', 'siren']]], 'SIREN prioritaire');
eq(pick(findDelegataire(sheet, place('200067106', "Communauté d'agglomération du Pays Basque", '64', 'Pyrénées-Atlantiques'))), [true, 'epci', [['CA du Pays Basque', 'exact']]], 'EPCI avant DDTM');
eq(pick(findDelegataire(sheet, place('200069854', 'Grand Poitiers Communauté urbaine', '86', 'Vienne'))), [true, 'epci', [["Communauté d'agglomération Grand Poitiers", 'exact']]], 'intitulé différent, même territoire');
eq(pick(findDelegataire(sheet, place('244200770', 'Saint-Etienne Métropole', '42', 'Loire'))), [true, 'epci', [['Saint-Étienne Métropole', 'exact']]], 'accents et tirets');
eq(pick(findDelegataire({ headers: ['Nom'], rows: [['Pays Basque Sud']] }, place('200067106', 'CA du Pays Basque', '64', 'Pyrénées-Atlantiques'))), [true, 'epci', [['Pays Basque Sud', 'approx']]], 'nom approché signalé');
eq(findDelegataire({ headers: ['Nom'], rows: [['Pays de Lyon'], ['DDT du Rhône']] }, place('1', 'CC du Pays Lyonnais', '69', 'Rhône')).level, 'ddt', 'Lyon ≠ Lyonnais');
// 2. Pas de délégataire : DDT / DDTM active du département (nom ou numéro).
eq(pick(findDelegataire(sheet, place('200068781', 'CA Valence Romans Agglo', '26', 'Drôme'))), [false, 'ddt', [['DDT de la Drôme', 'exact']]], 'délégataire « Non » en colonne B → DDT');
eq(pick(findDelegataire(sheet, place('246400337', 'CC du Béarn des Gaves', '64', 'Pyrénées-Atlantiques'))), [false, 'ddt', [['DDTM 64', 'exact']]], 'DDTM désignée par son numéro');
// 3. Sinon, forcément le département.
eq(pick(findDelegataire(sheet, place('200066793', 'CC du Pays de Cruseilles', '74', 'Haute-Savoie'))), [true, 'departement', [['Conseil départemental de la Haute-Savoie', 'exact']]], 'DDT « Non » → département');
eq(pick(findDelegataire(sheet, place('200071165', 'CC fictive', '07', 'Ardèche'))), [true, 'departement', []], 'aucune DDT dans le tableur → département');
eq(pick(findDelegataire(sheet, { epci: null, departement: null })), [false, 'inconnu', []], 'ni EPCI ni département');
eq(findDelegataire(sheet, place('1', 'CC fictive', '2A', 'Corse-du-Sud')).level, 'departement', 'code 2A');
console.log(`match : ${n} vérifications OK`);
