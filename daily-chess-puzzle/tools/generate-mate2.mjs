// Random search for clean mate-in-2 positions around a sheltered king.
// Usage: node generate-mate2.mjs <seed> <seconds>  → found-<seed>.json (review, then add to generated.json)
import { Chess } from 'chess.js'; import fs from 'fs';
import { forces, keys } from './solver.mjs';
function valid(fen) { try { new Chess(fen); const p = fen.split(' '); p[1] = 'b'; return new Chess(p.join(' '), { skipValidation: true }).isCheck() ? 'check' : null; } catch (e) { return e.message; } }
let seed = +process.argv[2]; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const shelters = [['g8','f7','g7','h7'],['g8','f7','g6','h7'],['g8','f7','g7','h6'],['h8','g7','h7','f7'],['g8','f6','g7','h7'],['h8','g7','h6'],['g8','g7','h7'],['c8','a7','b7','c7'],['b8','a7','b7','c7'],['g8','f7','g6','h5']];
const files='abcdefgh';
const sqName = (f,r)=>files[f]+(r+1);
const t0 = Date.now(), budget = +process.argv[3]*1000; const found = []; let tried = 0;
while (Date.now() - t0 < budget) {
  const board = {}; const sh = pick(shelters);
  board[sh[0]] = 'k'; for (const s of sh.slice(1)) board[s] = 'p';
  // white king castled-ish
  board[pick(['g1','h1','b1','c1','f1'])] = 'K';
  for (const s of pick([['f2','g2','h2'],['a2','b2','c2'],['g2','h2'],['f2','g3','h2']])) if (!board[s]) board[s] = 'P';
  const nA = 2 + Math.floor(rnd()*2), nD = 1 + Math.floor(rnd()*3);
  const free = () => { for(;;){ const s = sqName(Math.floor(rnd()*8), Math.floor(rnd()*8)); if (!board[s]) return s; } };
  for (let i=0;i<nA;i++){ const s=free(); const pc=pick('QRRBBNNP'); if (pc==='P' && /[18]/.test(s[1])) continue; board[s]=pc; }
  for (let i=0;i<nD;i++){ const s=free(); const pc=pick('qrrbbnnpp'); if (pc==='p' && /[18]/.test(s[1])) continue; board[s]=pc; }
  let rows=[]; for(let r=7;r>=0;r--){ let row=''; for(let f=0;f<8;f++) row+=board[sqName(f,r)]||'1'; rows.push(row.replace(/1+/g,x=>x.length)); }
  const fen = rows.join('/') + ' w - - 0 1'; tried++;
  if (valid(fen)) continue;
  const c = new Chess(fen);
  if (c.isGameOver() || c.isCheck()) continue;
  if (forces(c, 1) || !forces(c, 2)) continue;
  const ks = keys(c, 2); if (ks.length !== 1) continue;
  const k = ks[0]; c.move(k); const replies = c.moves({verbose:true}); 
  const sac = replies.some(r => r.to === k.to && r.captured);
  const quiet = !k.san.includes('+');
  c.undo();
  if (!(sac || (quiet && replies.length >= 3))) continue;
  found.push({ fen, n: 2, key: k.san, sac, quiet }); console.log(fen, k.san, sac?'sac':'', quiet?'quiet':'');
}
fs.writeFileSync(`found-${process.argv[2]}.json`, JSON.stringify(found)); console.log('tried', tried, 'found', found.length);
