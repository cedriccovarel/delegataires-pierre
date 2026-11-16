import assert from 'node:assert/strict'; import fs from 'node:fs';
globalThis.fetch = async u => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(new URL(u, import.meta.url))) });
const { loadAnru, anruAt } = await import('./anru.js');
const idx = await loadAnru('./data/npnru.json');
assert.equal(idx.quartiers.length, 480);
// Un point au centre de l'emprise d'un quartier n'est pas forcément dedans : on prend un sommet décalé vers le centroïde.
const q = idx.quartiers.find(x => x.cat === 'national'), r = q.rings[0];
const c = r.reduce((a, [la, lo]) => [a[0] + la / r.length, a[1] + lo / r.length], [0, 0]);
const inside = anruAt(idx, c[0], c[1]); assert.ok(inside, 'centroïde du premier anneau dans un quartier');
assert.equal(anruAt(idx, 46.6, 2.4), null); // centre de la France, hors quartier
console.log('anru OK', inside.nom);
