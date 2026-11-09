/* Daily Chess Puzzle — everyone gets the same puzzle on the same calendar day. */
(function () {
  'use strict';

  // Day 1 of the puzzle calendar. The puzzle for a date is PUZZLES[(days since this) mod count].
  const EPOCH = Date.UTC(2026, 10, 9); // 9 Nov 2026
  const DAY_MS = 86400000;
  const STORE_KEY = 'daily-chess-puzzle:v1';
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const VS = '︎'; // text presentation, keeps iOS from drawing emoji pawns

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');

  // ---------- date / puzzle selection ----------
  function localDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayIndexFor(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS);
  }
  const params = new URLSearchParams(location.search);
  const override = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : null;
  const todayKey = localDateKey(new Date());
  const dateKey = override || todayKey;
  const dayIdx = dayIndexFor(dateKey);
  const N = window.PUZZLES.length;
  const puzzle = window.PUZZLES[((dayIdx % N) + N) % N];
  const puzzleNo = dayIdx + 1;

  // ---------- persistence ----------
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { days: {} }; } catch (e) { return { days: {} }; }
  }
  function saveStore() {
    if (override) return; // previewing another day doesn't touch your stats
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage unavailable */ }
  }
  const store = loadStore();
  if (!store.days) store.days = {};

  // ---------- state ----------
  const game = new window.Chess(puzzle.fen);
  const player = game.turn();
  const playerMoves = puzzle.n;
  // puzzle.tree: list of accepted player moves. Each entry is [uci] for a mating move,
  // or [uci, opponentReplyUci, nextNode] when the puzzle continues.
  let node = puzzle.tree;  // current player node
  let played = [];         // ucis played so far (player + replies), for resuming
  let done = 0;            // player moves completed
  let tries = 1;           // attempt number for the current puzzle
  let hints = 0;           // total hints used
  let hintLevel = 0;       // 0 none, 1 piece, 2 piece + target (for the current step)
  let events = [];         // for the share string: 'x' wrong, 'h' hint, 'o' correct
  let status = 'playing';  // playing | solved | revealed
  let locked = false;
  let selected = null;
  let lastMove = null;
  let badSquare = null;

  const saved = store.days[dateKey];
  if (saved && saved.fen === puzzle.fen) {
    tries = saved.tries || 1; hints = saved.hints || 0; events = saved.events || [];
    status = saved.status || 'playing';
    try { replay(saved.played || []); } catch (e) { replay([]); status = 'playing'; }
  }

  // Walk the tree along a list of played ucis (player, reply, player, ...).
  function replay(list) {
    game.load(puzzle.fen); node = puzzle.tree; played = []; done = 0; lastMove = null;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (i % 2 === 0) {
        const opt = node.find((o) => o[0] === u) || (node[0].length === 1 ? [u] : null);
        if (!opt) throw new Error('bad save');
        lastMove = applyUci(u); played.push(u); done++;
        if (opt.length === 1) return;
        node = opt;
      } else {
        lastMove = applyUci(u); played.push(u);
        node = node[2];
      }
    }
    if (list.length % 2 === 1 && node.length === 3) { /* reply pending; handled at start-up */ }
  }

  function persist() {
    store.days[dateKey] = { fen: puzzle.fen, status, tries, hints, events, played };
    saveStore();
  }
  function mainMove() { return node[0][0]; }

  // ---------- helpers ----------
  function applyUci(u) {
    const m = game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
    return { from: m.from, to: m.to };
  }
  const files = 'abcdefgh';
  function squareOrder() {
    const out = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      out.push(player === 'w' ? files[f] + (8 - r) : files[7 - f] + (r + 1));
    }
    return out;
  }
  function kingSquare(color) {
    for (const row of game.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
    return null;
  }
  function legalTargets(sq) { return game.moves({ square: sq, verbose: true }).map((m) => m.to); }
  function canInteract() { return status === 'playing' && !locked && game.turn() === player; }

  // ---------- board rendering ----------
  const sqEls = {};
  squareOrder().forEach((sq, i) => {
    const el = document.createElement('div');
    const f = files.indexOf(sq[0]); const r = +sq[1];
    el.className = 'sq ' + ((f + r) % 2 === 1 ? 'dark' : 'light');
    el.dataset.sq = sq;
    el.setAttribute('role', 'gridcell');
    const col = i % 8, row = Math.floor(i / 8);
    if (row === 7) el.insertAdjacentHTML('beforeend', '<span class="coord file">' + sq[0] + '</span>');
    if (col === 0) el.insertAdjacentHTML('beforeend', '<span class="coord rank">' + sq[1] + '</span>');
    boardEl.appendChild(el);
    sqEls[sq] = el;
  });

  function render(anim) {
    const targets = selected ? legalTargets(selected) : [];
    const hintFrom = hintLevel >= 1 && status === 'playing' ? mainMove().slice(0, 2) : null;
    const hintTo = hintLevel >= 2 && status === 'playing' ? mainMove().slice(2, 4) : null;
    const checkSq = game.isCheck() ? kingSquare(game.turn()) : null;
    for (const sq in sqEls) {
      const el = sqEls[sq];
      const p = game.get(sq);
      el.classList.toggle('last', !!lastMove && (lastMove.from === sq || lastMove.to === sq));
      el.classList.toggle('sel', selected === sq);
      el.classList.toggle('hint', sq === hintFrom || sq === hintTo);
      el.classList.toggle('bad', sq === badSquare);
      el.classList.toggle('check', sq === checkSq);
      el.classList.toggle('target', targets.includes(sq));
      el.classList.toggle('occupied', !!p);
      let pe = el.querySelector('.piece');
      if (p) {
        if (!pe) { pe = document.createElement('span'); el.appendChild(pe); }
        pe.className = 'piece ' + p.color;
        pe.textContent = GLYPH[p.type] + VS;
      } else if (pe) pe.remove();
      el.setAttribute('aria-label', sq + (p ? ' ' + (p.color === 'w' ? 'white ' : 'black ') + p.type : ''));
    }
    if (anim) animateMove(anim.from, anim.to);
    updatePanel();
  }

  function animateMove(from, to) {
    const pe = sqEls[to].querySelector('.piece');
    if (!pe) return;
    const a = sqEls[from].getBoundingClientRect(), b = sqEls[to].getBoundingClientRect();
    pe.style.transition = 'none';
    pe.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)';
    pe.getBoundingClientRect();
    pe.style.transition = 'transform .22s ease';
    pe.style.transform = '';
  }

  // ---------- panel ----------
  const sideName = player === 'w' ? 'White' : 'Black';
  $('puzzle-meta').textContent = 'Puzzle #' + puzzleNo + ' · ' +
    new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
    (override ? ' (preview)' : '');
  $('task-title').textContent = 'Mate in ' + puzzle.n;
  $('task-sub').textContent = sideName + ' to move — find checkmate' + (puzzle.n > 1 ? ' in ' + puzzle.n + ' moves.' : ' in one move.');
  $('turn-dot').className = 'turn-dot ' + player;

  function feedback(msg, kind) {
    const el = $('feedback');
    el.textContent = msg;
    el.className = 'feedback' + (kind ? ' ' + kind : '');
  }

  function updatePanel() {
    $('tries-count').textContent = tries;
    $('tries-count').nextElementSibling.textContent = tries === 1 ? 'Try' : 'Tries';
    $('hints-count').textContent = hints;
    $('moves-count').textContent = done + '/' + playerMoves;
    const playing = status === 'playing';
    $('hint-btn').disabled = !playing || hintLevel >= 2 || locked;
    $('hint-btn').textContent = hintLevel === 0 ? '💡 Hint' : hintLevel === 1 ? '💡 Another hint' : '💡 Hint shown';
    $('restart-btn').disabled = !playing || locked || played.length === 0;
    $('solution-btn').disabled = !playing || locked;
  }

  function shareSquares() {
    return events.map((e) => (e === 'x' ? '🟥' : e === 'h' ? '💡' : e === 'r' ? '⬛' : '🟩')).join('');
  }

  function showDone() {
    const d = $('done');
    d.hidden = false;
    if (status === 'solved') {
      $('done-title').textContent = tries === 1 && hints === 0 ? 'Perfect! 🎉' : 'Solved! 🎉';
      $('done-text').textContent = 'You found it in ' + tries + (tries === 1 ? ' try' : ' tries') +
        (hints ? ' with ' + hints + (hints === 1 ? ' hint.' : ' hints.') : ' with no hints.');
      feedback('Checkmate! Well played.', 'good');
    } else {
      $('done-title').textContent = 'Solution';
      $('done-text').textContent = 'Here is how it goes. Come back tomorrow for a new puzzle!';
      feedback('Solution: ' + solutionSan(), 'info');
    }
    $('done-note').textContent = '“' + puzzle.name + '”' + (puzzle.note ? ' — ' + puzzle.note : '');
    $('done-squares').textContent = shareSquares();
    updatePanel();
  }

  function mainLine() {
    const out = []; let t = puzzle.tree;
    while (t) { const o = t[0]; out.push(o[0]); if (o.length === 1) break; out.push(o[1]); t = o[2]; }
    return out;
  }
  function solutionSan() {
    const c = new window.Chess(puzzle.fen);
    const parts = [];
    mainLine().forEach((u, i) => {
      const moveNo = Math.floor(i / 2) + 1;
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
      if (player === 'w') parts.push((i % 2 === 0 ? moveNo + '. ' : '') + m.san);
      else parts.push(i === 0 ? '1... ' + m.san : (i % 2 === 1 ? moveNo + 1 + '. ' : '') + m.san);
    });
    return parts.join(' ');
  }

  // ---------- moves ----------
  function tryMove(from, to) {
    const legal = game.moves({ square: from, verbose: true }).find((m) => m.to === to);
    if (!legal) return false;
    selected = null;
    const promo = legal.promotion ? 'q' : '';
    const uci = from + to + promo;
    const isFinal = node[0].length === 1;
    const m = game.move({ from, to, promotion: promo || undefined });
    const opt = isFinal ? (game.isCheckmate() ? [uci] : null) : node.find((o) => o[0] === uci);
    if (opt) {
      events.push('o');
      lastMove = { from: m.from, to: m.to };
      played.push(uci); done++;
      hintLevel = 0;
      if (isFinal) {
        status = 'solved';
        persist();
        render();
        showDone();
        return true;
      }
      node = opt;
      feedback('Good move! Keep going…', 'good');
      persist();
      render();
      locked = true;
      setTimeout(playReply, 550);
    } else {
      events.push('x');
      badSquare = to;
      lastMove = { from: m.from, to: m.to };
      locked = true;
      render();
      boardEl.classList.remove('shake'); void boardEl.offsetWidth; boardEl.classList.add('shake');
      feedback('Not quite — that move doesn’t force mate. Try again!', 'bad');
      setTimeout(() => {
        game.undo();
        badSquare = null;
        const h = game.history({ verbose: true });
        lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
        tries++;
        locked = false;
        persist();
        render();
      }, 750);
    }
    return true;
  }

  // node is the chosen option [uci, reply, next] while a reply is pending
  function playReply() {
    const reply = applyUci(node[1]);
    played.push(node[1]);
    node = node[2];
    lastMove = reply;
    locked = false;
    persist();
    render(reply);
    const left = playerMoves - done;
    feedback('Your move — ' + left + (left === 1 ? ' move' : ' moves') + ' to go.', '');
  }

  // ---------- input: tap & drag ----------
  let drag = null;
  boardEl.addEventListener('pointerdown', (e) => {
    const sqEl = e.target.closest('.sq');
    if (!sqEl || !canInteract()) return;
    const sq = sqEl.dataset.sq;
    const p = game.get(sq);
    if (selected && selected !== sq && legalTargets(selected).includes(sq)) {
      tryMove(selected, sq);
      return;
    }
    if (p && p.color === player) {
      const wasSelected = selected === sq;
      selected = sq;
      render();
      const pe = sqEl.querySelector('.piece');
      const ghost = pe.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.fontSize = getComputedStyle(pe).fontSize;
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      document.body.appendChild(ghost);
      pe.classList.add('lift');
      drag = { from: sq, ghost, wasSelected, moved: false, x: e.clientX, y: e.clientY };
      boardEl.setPointerCapture(e.pointerId);
    } else {
      selected = null;
      render();
    }
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
  });
  function endDrag(e, cancelled) {
    if (!drag) return;
    const d = drag; drag = null;
    d.ghost.remove();
    const under = cancelled ? null : document.elementFromPoint(e.clientX, e.clientY);
    const sqEl = under && under.closest && under.closest('.sq');
    const to = sqEl ? sqEl.dataset.sq : null;
    if (to && to !== d.from && legalTargets(d.from).includes(to)) { tryMove(d.from, to); return; }
    if (to === d.from && d.wasSelected && !d.moved) selected = null; // tap again to deselect
    render();
  }
  boardEl.addEventListener('pointerup', (e) => endDrag(e, false));
  boardEl.addEventListener('pointercancel', (e) => endDrag(e, true));

  // ---------- buttons ----------
  $('hint-btn').addEventListener('click', () => {
    if (status !== 'playing' || hintLevel >= 2 || locked) return;
    hintLevel++; hints++; events.push('h');
    selected = null;
    const p = game.get(mainMove().slice(0, 2));
    const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
    feedback(hintLevel === 1
      ? 'Hint: move your ' + names[p.type] + ' (highlighted).'
      : 'Hint: move it to ' + mainMove().slice(2, 4) + '.', 'info');
    persist();
    render();
  });

  $('restart-btn').addEventListener('click', () => {
    if (status !== 'playing' || locked) return;
    replay([]);
    hintLevel = 0; selected = null;
    feedback('Back to the start. Your tries and hints are kept.', '');
    persist();
    render();
  });

  $('solution-btn').addEventListener('click', () => {
    if (status !== 'playing' || locked) return;
    if (!confirm('Show the solution? Today will count as not solved.')) return;
    status = 'revealed'; events.push('r'); locked = true; selected = null; hintLevel = 0;
    persist();
    const playNext = () => {
      if (!node) { locked = false; render(); showDone(); return; }
      if (played.length % 2 === 0) {
        const o = node[0]; const mv = applyUci(o[0]); played.push(o[0]); done++;
        node = o.length === 1 ? null : o; lastMove = mv; render(mv);
      } else {
        const mv = applyUci(node[1]); played.push(node[1]); node = node[2]; lastMove = mv; render(mv);
      }
      setTimeout(playNext, 700);
    };
    render();
    setTimeout(playNext, 300);
  });

  $('share-btn').addEventListener('click', async () => {
    const result = status === 'solved'
      ? 'Solved in ' + tries + (tries === 1 ? ' try' : ' tries') + (hints ? ' · ' + hints + ' 💡' : '')
      : 'Peeked at the solution';
    const text = '♞ Daily Chess Puzzle #' + puzzleNo + ' — Mate in ' + puzzle.n + '\n' + result + '\n' + shareSquares();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard!');
    } catch (e) {
      toast('Could not copy — ' + text.replace(/\n/g, ' '));
    }
  });

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ---------- stats ----------
  function computeStats() {
    const keys = Object.keys(store.days).filter((k) => store.days[k].status !== 'playing').sort();
    const solvedSet = new Set(keys.filter((k) => store.days[k].status === 'solved'));
    let best = 0, run = 0, prev = null;
    for (const k of [...solvedSet].sort()) {
      const idx = dayIndexFor(k);
      run = prev !== null && idx === prev + 1 ? run + 1 : 1;
      prev = idx; best = Math.max(best, run);
    }
    let cur = 0;
    let idx = dayIndexFor(todayKey);
    const e = new Date(EPOCH);
    const keyFor = (i) => localDateKey(new Date(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate() + i));
    if (!solvedSet.has(keyFor(idx))) idx--; // today's not done yet: streak still alive from yesterday
    while (solvedSet.has(keyFor(idx))) { cur++; idx--; }
    return { played: keys.length, solved: solvedSet.size, cur, best };
  }
  $('stats-btn').addEventListener('click', () => {
    const s = computeStats();
    $('st-played').textContent = s.played; $('st-solved').textContent = s.solved;
    $('st-streak').textContent = s.cur; $('st-best').textContent = s.best;
    $('stats-dialog').showModal();
  });

  // ---------- countdown ----------
  function tick() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    $('countdown').textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
    if (!override && localDateKey(now) !== todayKey) location.reload();
  }
  tick(); setInterval(tick, 1000);

  // ---------- go ----------
  render();
  if (status === 'playing') {
    feedback(played.length === 0 ? sideName + ' to move. Good luck!' : 'Welcome back — pick up where you left off.', '');
    if (played.length % 2 === 1) playReply(); // reloaded while the opponent's reply was pending
  } else {
    showDone();
  }
})();
