import { Chess } from 'chess.js';
// Does side to move force mate within n of its own moves?
export function forces(c, n) {
  const ms = c.moves({ verbose: true });
  if (n === 1) return ms.some(m => m.san.endsWith('#'));
  // try checks/captures first for speed
  ms.sort((a, b) => score(b) - score(a));
  for (const m of ms) if (moveForces(c, m, n)) return true;
  return false;
}
function score(m){ return (m.san.includes('+')?2:0) + (m.captured?1:0); }
export function moveForces(c, m, n) {
  if (m.san.endsWith('#')) return true;
  if (n === 1) return false;
  c.move(m);
  let ok;
  if (c.isGameOver()) ok = false;
  else {
    ok = true;
    for (const r of c.moves({ verbose: true })) {
      c.move(r);
      const f = forces(c, n - 1);
      c.undo();
      if (!f) { ok = false; break; }
    }
  }
  c.undo();
  return ok;
}
// minimum mate length for a given position (attacker to move), up to max
export function mateLen(c, max) { for (let k = 1; k <= max; k++) if (forces(c, k)) return k; return null; }
export function keys(c, n) {
  return c.moves({ verbose: true }).filter(m => moveForces(c, m, n));
}
