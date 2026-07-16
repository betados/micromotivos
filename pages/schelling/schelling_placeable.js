/* Schelling with a placeable intruder — vanilla JS, no dependencies.
 *
 * Sibling of schelling.js. Starts from an already-settled (segregated) city.
 * Click a cell to drop a citizen of the group OPPOSITE to that neighbourhood —
 * an intruder — and the simulation re-runs so you can watch what the model does
 * with them. Low threshold: the intruder is expelled and the bloc doesn't move.
 * High threshold: one intruder sets off a cascade of re-sorting.
 *
 * Self-contained IIFE with its own DOM ids (place-*) so it never collides with
 * the first widget on the same page. */
(function () {
  'use strict';

  // Cell states
  var EMPTY = 0, BLUE = 1, ORANGE = 2;

  // Must match --empty/--blue/--orange in schelling.css.
  var COLORS = {};
  COLORS[EMPTY] = '#ffffff';
  COLORS[BLUE] = '#9dc0ee';
  COLORS[ORANGE] = '#f2bd84';

  // Structure is fixed here — the reader tunes only the threshold, so the
  // "drop one intruder into a settled city" demo stays clean.
  var SIZE = 50, EMPTY_FRAC = 0.10, BLUE_SHARE = 0.50;
  var SETTLE_CAP = 600; // ticks; every threshold up to 70% settles well under this

  var canvas = document.getElementById('grid-place');
  var ctx = canvas.getContext('2d');

  var el = function (id) { return document.getElementById(id); };
  var toleranceInput = el('place-tolerance');
  var speedInput = el('place-speed');
  var resettleBtn = el('place-resettle');

  var grid = null;   // Int8Array of length SIZE*SIZE
  var step = 0;      // steps since the last settle (i.e. since the intruder)
  var timer = null;  // setTimeout handle while the heal is running
  var pinned = new Set(); // cells of placed foreigners — they just moved in, so
                          // they never move again; the neighbourhood reacts instead

  // ---------------------------------------------------------------------------
  // Model (same rules as schelling.js)
  // ---------------------------------------------------------------------------

  function randomGrid() {
    var total = SIZE * SIZE;
    var g = new Int8Array(total);
    for (var i = 0; i < total; i++) {
      if (Math.random() < EMPTY_FRAC) g[i] = EMPTY;
      else g[i] = Math.random() < BLUE_SHARE ? BLUE : ORANGE;
    }
    return g;
  }

  // Occupied-neighbour tallies: how many match self, how many total, and the
  // per-group counts (used to choose the intruder's group).
  function neighbours(idx) {
    var self = grid[idx];
    var r = (idx / SIZE) | 0, c = idx % SIZE;
    var same = 0, occ = 0, blue = 0, orange = 0;
    for (var dr = -1; dr <= 1; dr++) {
      var nr = r + dr;
      if (nr < 0 || nr >= SIZE) continue;
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nc = c + dc;
        if (nc < 0 || nc >= SIZE) continue;
        var v = grid[nr * SIZE + nc];
        if (v === EMPTY) continue;
        occ++;
        if (v === self) same++;
        if (v === BLUE) blue++; else orange++;
      }
    }
    return { same: same, occ: occ, blue: blue, orange: orange };
  }

  function similarity(idx) {
    var n = neighbours(idx);
    return n.occ === 0 ? 1 : n.same / n.occ;
  }

  function threshold() { return parseInt(toleranceInput.value, 10) / 100; }

  // Advance one round. Returns the number of agents that moved.
  function tick() {
    var thr = threshold();
    var total = SIZE * SIZE;
    var unhappy = [], empties = [];
    for (var i = 0; i < total; i++) {
      if (grid[i] === EMPTY) empties.push(i);
      else if (!pinned.has(i) && similarity(i) < thr) unhappy.push(i);
    }
    shuffle(unhappy);
    var moved = 0;
    for (var u = 0; u < unhappy.length; u++) {
      if (empties.length === 0) break;
      var from = unhappy[u];
      var pick = (Math.random() * empties.length) | 0;
      var to = empties[pick];
      grid[to] = grid[from];
      grid[from] = EMPTY;
      empties[pick] = from;
      moved++;
    }
    return moved;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  // Run to equilibrium with no drawing, for the initial settled city.
  function settleInstant() {
    for (var s = 0; s < SETTLE_CAP; s++) {
      if (tick() === 0) return;
    }
  }

  function happyFraction() {
    var thr = threshold();
    var total = SIZE * SIZE, occ = 0, happy = 0;
    for (var i = 0; i < total; i++) {
      if (grid[i] === EMPTY) continue;
      occ++;
      if (similarity(i) >= thr) happy++;
    }
    return occ === 0 ? 1 : happy / occ;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function fitCanvas() {
    var cell = Math.max(1, Math.round(500 / SIZE));
    canvas.width = canvas.height = cell * SIZE;
  }

  function draw() {
    var cell = canvas.width / SIZE;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        ctx.fillStyle = COLORS[grid[r * SIZE + c]];
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }

  function updateStats(status) {
    el('place-step').textContent = step;
    el('place-happy').textContent = Math.round(happyFraction() * 100) + '%';
    if (status) el('place-status').textContent = status;
  }

  // ---------------------------------------------------------------------------
  // Settled city + intruder
  // ---------------------------------------------------------------------------

  function isRunning() { return timer !== null; }

  function stopRun() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  }

  // Build a fresh random city and run it to its segregated equilibrium.
  function resettle() {
    stopRun();
    pinned.clear();  // must be empty while the fresh city settles
    grid = randomGrid();
    settleInstant();
    step = 0;
    fitCanvas();
    draw();
    updateStats('Ciudad asentada — coloca vecinos donde no les toca');
  }

  function loop() {
    var moved = tick();
    step++;
    draw();
    if (moved === 0) {
      stopRun();
      updateStats('Estable de nuevo');
      return;
    }
    updateStats('Los vecinos reaccionan…');
    timer = setTimeout(loop, parseInt(speedInput.value, 10));
  }

  function startRun() {
    if (isRunning()) return; // a run already in progress will see the new grid
    timer = setTimeout(loop, parseInt(speedInput.value, 10));
  }

  // Drop an intruder: place a citizen of the group OPPOSITE the local majority.
  function placeIntruder(idx) {
    var n = neighbours(idx);
    var intruder;
    if (n.blue > n.orange) intruder = ORANGE;
    else if (n.orange > n.blue) intruder = BLUE;
    else intruder = grid[idx] === BLUE ? ORANGE : BLUE; // tie / empty spot

    // The newcomer takes an occupied house, so its resident doesn't vanish —
    // they relocate to a random empty cell, the same rule the model uses for
    // any mover. That displaced resident (not pinned) is what seeds the
    // cascade. If the map is full, fall back to overwriting so we never wedge.
    if (grid[idx] !== EMPTY) {
      var empties = [];
      for (var i = 0; i < SIZE * SIZE; i++) if (grid[i] === EMPTY) empties.push(i);
      if (empties.length) grid[empties[(Math.random() * empties.length) | 0]] = grid[idx];
    }

    grid[idx] = intruder;
    pinned.add(idx); // he just moved in — he's not moving again
    step = 0;        // count the neighbourhood's reaction from here
    draw();
    updateStats('Recién llegado');
    startRun();
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  canvas.addEventListener('click', function (e) {
    // Map against the CSS-displayed size (canvas is stretched to 100% width),
    // not the internal pixel size.
    var rect = canvas.getBoundingClientRect();
    var c = Math.floor((e.clientX - rect.left) / rect.width * SIZE);
    var r = Math.floor((e.clientY - rect.top) / rect.height * SIZE);
    if (c < 0 || c >= SIZE || r < 0 || r >= SIZE) return;
    placeIntruder(r * SIZE + c);
  });

  resettleBtn.addEventListener('click', resettle);

  function syncLabels() {
    el('place-tolerance-val').textContent = toleranceInput.value + '%';
    var s = parseInt(speedInput.value, 10);
    el('place-speed-val').textContent = s <= 40 ? 'Rápida' : s <= 150 ? 'Media' : 'Lenta';
  }

  toleranceInput.addEventListener('input', syncLabels);
  // Re-settling runs to equilibrium — do it on release, not on every drag frame.
  toleranceInput.addEventListener('change', resettle);
  speedInput.addEventListener('input', syncLabels);

  // Boot
  syncLabels();
  resettle();
})();
