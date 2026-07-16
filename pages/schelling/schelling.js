/* Schelling's model of segregation — vanilla JS, no dependencies. */
(function () {
  'use strict';

  // Cell states
  var EMPTY = 0, BLUE = 1, ORANGE = 2;

  // Must match --empty/--blue/--orange in schelling.css.
  var COLORS = {};
  COLORS[EMPTY] = '#ffffff';
  COLORS[BLUE] = '#9dc0ee';
  COLORS[ORANGE] = '#f2bd84';

  var canvas = document.getElementById('grid');
  var ctx = canvas.getContext('2d');

  // --- DOM controls ---
  var el = function (id) { return document.getElementById(id); };
  var sizeInput = el('size');
  var toleranceInput = el('tolerance');
  var emptyInput = el('empty');
  var ratioInput = el('ratio');
  var speedInput = el('speed');
  var runBtn = el('run');
  var stepBtn = el('step');
  var resetBtn = el('reset');

  // --- Simulation state ---
  var size = 50;          // grid is size x size
  var grid = null;        // Int8Array of length size*size
  var step = 0;
  var timer = null;       // setTimeout handle while running

  // ---------------------------------------------------------------------------
  // Model
  // ---------------------------------------------------------------------------

  function initGrid() {
    size = parseInt(sizeInput.value, 10);
    var total = size * size;
    grid = new Int8Array(total);

    var emptyFrac = parseInt(emptyInput.value, 10) / 100;
    var blueShare = parseInt(ratioInput.value, 10) / 100; // share of the *occupied* cells

    for (var i = 0; i < total; i++) {
      if (Math.random() < emptyFrac) {
        grid[i] = EMPTY;
      } else {
        grid[i] = Math.random() < blueShare ? BLUE : ORANGE;
      }
    }
    step = 0;
  }

  // Fraction of occupied neighbours that share the agent's group.
  // Returns 1 (content) when an agent has no occupied neighbours.
  function similarity(idx) {
    var self = grid[idx];
    var r = (idx / size) | 0;
    var c = idx % size;
    var same = 0, occupied = 0;

    for (var dr = -1; dr <= 1; dr++) {
      var nr = r + dr;
      if (nr < 0 || nr >= size) continue;
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nc = c + dc;
        if (nc < 0 || nc >= size) continue;
        var v = grid[nr * size + nc];
        if (v === EMPTY) continue;
        occupied++;
        if (v === self) same++;
      }
    }
    if (occupied === 0) return 1;
    return same / occupied;
  }

  // Advance one round. Returns { happy: fraction, moved: count }.
  function tick() {
    var threshold = parseInt(toleranceInput.value, 10) / 100;
    var total = size * size;

    var unhappy = [];
    var empties = [];
    var occupied = 0;

    for (var i = 0; i < total; i++) {
      if (grid[i] === EMPTY) {
        empties.push(i);
      } else {
        occupied++;
        if (similarity(i) < threshold) unhappy.push(i);
      }
    }

    // Move each unhappy agent to a random empty cell. The vacated cell becomes
    // available to later movers, keeping the empty-count constant.
    shuffle(unhappy);
    shuffle(empties);
    var moved = 0;
    for (var u = 0; u < unhappy.length; u++) {
      if (empties.length === 0) break;
      var from = unhappy[u];
      var pick = (Math.random() * empties.length) | 0;
      var to = empties[pick];
      grid[to] = grid[from];
      grid[from] = EMPTY;
      empties[pick] = from; // vacated cell is now empty
      moved++;
    }

    step++;
    var happy = occupied === 0 ? 1 : (occupied - unhappy.length) / occupied;
    return { happy: happy, moved: moved };
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  // Size the canvas to an integer multiple of the cell size so cells tile
  // exactly (no antialiasing seams). CSS still stretches it to full width.
  function fitCanvas() {
    var cell = Math.max(1, Math.round(500 / size));
    canvas.width = canvas.height = cell * size;
  }

  function draw() {
    var cell = canvas.width / size;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        ctx.fillStyle = COLORS[grid[r * size + c]];
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }

  function currentHappy() {
    var threshold = parseInt(toleranceInput.value, 10) / 100;
    var total = size * size, occupied = 0, happy = 0;
    for (var i = 0; i < total; i++) {
      if (grid[i] === EMPTY) continue;
      occupied++;
      if (similarity(i) >= threshold) happy++;
    }
    return occupied === 0 ? 1 : happy / occupied;
  }

  function updateStats(happy, status) {
    el('stat-step').textContent = step;
    el('stat-happy').textContent = Math.round(happy * 100) + '%';
    if (status) el('stat-status').textContent = status;
  }

  // ---------------------------------------------------------------------------
  // Run loop
  // ---------------------------------------------------------------------------

  function isRunning() { return timer !== null; }

  function doStep() {
    var result = tick();
    draw();
    updateStats(result.happy);
    return result;
  }

  function loop() {
    var result = doStep();
    if (result.moved === 0) {
      stop();
      updateStats(result.happy, 'Estable — todos felices');
      return;
    }
    var delay = parseInt(speedInput.value, 10);
    timer = setTimeout(loop, delay);
  }

  function start() {
    if (isRunning()) return;
    updateStats(currentHappy(), 'Ejecutando…');
    timer = setTimeout(loop, 0);
    runBtn.textContent = 'Pausar';
    runBtn.classList.remove('primary');
  }

  function stop() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    runBtn.textContent = 'Ejecutar';
    runBtn.classList.add('primary');
  }

  function reset() {
    stop();
    initGrid();
    fitCanvas();
    draw();
    updateStats(currentHappy(), 'Listo');
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  runBtn.addEventListener('click', function () {
    if (isRunning()) { stop(); updateStats(currentHappy(), 'En pausa'); }
    else start();
  });

  stepBtn.addEventListener('click', function () {
    if (isRunning()) return;
    var result = doStep();
    updateStats(result.happy, result.moved === 0 ? 'Estable — todos felices' : 'Paso completado');
  });

  resetBtn.addEventListener('click', reset);

  // Live labels; changing structural sliders rebuilds the grid.
  function syncLabels() {
    el('size-val').textContent = sizeInput.value;
    el('size-val2').textContent = sizeInput.value;
    el('tolerance-val').textContent = toleranceInput.value + '%';
    el('empty-val').textContent = emptyInput.value + '%';
    el('ratio-val').textContent = ratioInput.value + ' / ' + (100 - parseInt(ratioInput.value, 10));
    var s = parseInt(speedInput.value, 10);
    el('speed-val').textContent = s <= 40 ? 'Rápida' : s <= 150 ? 'Media' : 'Lenta';
  }

  [sizeInput, emptyInput, ratioInput].forEach(function (input) {
    input.addEventListener('input', function () { syncLabels(); reset(); });
  });

  toleranceInput.addEventListener('input', function () {
    syncLabels();
    if (!isRunning()) updateStats(currentHappy());
  });

  speedInput.addEventListener('input', syncLabels);

  // Boot
  syncLabels();
  reset();
})();
