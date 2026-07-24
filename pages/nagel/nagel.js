/* Nagel-Schreckenberg traffic on a ring road — continuous variant, vanilla JS.
 *
 * Positions and speeds are real numbers (the original paper is a cellular
 * automaton). The update is the Krauss safe-speed scheme, the standard
 * continuous descendant of Nagel-Schreckenberg: accelerate towards vmax,
 * never exceed the speed that lets you brake behind your leader, and every
 * now and then dawdle for no reason at all. The dawdling is what nucleates
 * the ghost jams.
 */
(function () {
  'use strict';

  // Speed ramp, must match --red/--amber/--green/--blue in nagel.css. The four
  // stops are one OKLCH sweep at fixed lightness 0.70 and fixed chroma 0.150,
  // hue 29/70/145/264 — only the hue moves, so no stop reads louder or dimmer
  // than the others and the ring has no bright or dark hotspots. Amber is the
  // midpoint because red interpolated straight to green passes through a muddy
  // olive. Recompute the whole set together if any of it changes.
  var RED = { r: 237, g: 118, b: 102 };   // stopped
  var AMBER = { r: 217, g: 139, b: 9 };   // half the equilibrium speed
  var GREEN = { r: 91, g: 182, b: 97 };   // as fast as this density allows
  var BLUE = { r: 110, g: 155, b: 251 };  // past it: escaping a jam

  // --- Physics constants (SI units) ---
  var L = 600;          // ring circumference, m
  var CAR_LEN = 4.5;    // m
  var MIN_GAP = 0.5;    // hard bumper-to-bumper minimum, m
  var ACCEL = 2.0;      // m/s^2, an unhurried pull-away rather than a launch
  var BRAKE = 4.5;      // comfortable deceleration, m/s^2
  var TAU = 1.2;        // reaction/headway time, s
  var DAWDLE_KICK = 5;  // a dawdle sheds up to this much speed, m/s
  var BRAKE_HOLD = 1.5; // a forced frenazo pins the car for this long, s

  // Start-up lost time: a driver at a standstill does not pull away the
  // instant the road ahead clears. Queues therefore discharge one car at a
  // time from the front, which is what makes a jam outlive the braking that
  // caused it.
  var START_DELAY = 0.7; // s spent stationary before moving off
  var CREEP = 0.3;       // below this a car counts as stopped, m/s
  var ESCAPE_SPAN = 0.5; // full blue at this much above the equilibrium speed

  // The step length is measured from the frame clock, so the traffic advances
  // at the same rate on any display.
  var TIME_SCALE = 3;   // simulated seconds per wall-clock second
  var DT_MAX = 0.1;     // never integrate a longer step than this, s
  var ST_ROW = 0.15;    // simulated seconds between space-time rows
  var STAT_EVERY = 0.5; // simulated seconds between stat refreshes

  var roadCanvas = document.getElementById('road');
  var roadCtx = roadCanvas.getContext('2d');
  var stCanvas = document.getElementById('spacetime');
  var stCtx = stCanvas.getContext('2d');

  // --- DOM controls ---
  var el = function (id) { return document.getElementById(id); };
  var carsInput = el('cars');
  var dawdleInput = el('dawdle');
  var vmaxInput = el('vmax');
  var brakeBtn = el('brake');
  var runBtn = el('run');
  var resetBtn = el('reset');

  // --- Simulation state ---
  // Cars stay sorted by position (no overtaking), car i's leader is i+1 mod n.
  var xs = [];          // position along the ring, m in [0, L)
  var vs = [];          // speed, m/s
  var brakeUntil = [];  // sim time until which the car is pinned at v = 0
  var readyAt = [];     // sim time a stopped car may move off; 0 = not waiting
  var t = 0;            // simulated time, s
  var running = true;

  // --- Ring geometry (canvas pixels) ---
  var CX = roadCanvas.width / 2;
  var CY = roadCanvas.height / 2;
  var R = 190;          // road centreline radius
  var ROAD_W = 36;

  function vmaxMs() { return parseInt(vmaxInput.value, 10) / 3.6; }

  // Dawdle events per car per second: 0% -> never, 100% -> one every 2 s.
  function dawdleRate() { return parseInt(dawdleInput.value, 10) / 100 * 0.5; }

  // Fastest a car can sustain at the current density: with n cars evenly
  // spaced the equilibrium speed is the gap divided by the headway time,
  // capped by the speed limit. Depends only on the two sliders, so it holds
  // still while the traffic moves.
  function freeSpeed() {
    var n = parseInt(carsInput.value, 10);
    var gap = L / n - CAR_LEN;
    return Math.max(1, Math.min(vmaxMs(), gap / TAU));
  }

  function init() {
    var n = parseInt(carsInput.value, 10);
    var spacing = L / n;
    var v0 = freeSpeed();
    xs = []; vs = []; brakeUntil = []; readyAt = [];
    for (var i = 0; i < n; i++) {
      xs.push(i * spacing);
      vs.push(v0);
      brakeUntil.push(0);
      readyAt.push(0);
    }
    t = 0;

    stCtx.fillStyle = '#ffffff';
    stCtx.fillRect(0, 0, stCanvas.width, stCanvas.height);
  }

  function gapAhead(i) {
    var j = (i + 1) % xs.length;
    return (xs[j] - xs[i] - CAR_LEN + L * 2) % L;
  }

  function step(dt) {
    var n = xs.length;
    var vmax = vmaxMs();
    var pDawdle = dawdleRate() * dt;
    t += dt;

    // Parallel update: every new speed reads the previous state.
    var newVs = new Array(n);
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var g = gapAhead(i);
      var vl = vs[j];
      var vsafe = vl + (g - vl * TAU) / ((vs[i] + vl) / (2 * BRAKE) + TAU);
      var nv = Math.min(vmax, vs[i] + ACCEL * dt, vsafe);
      nv = Math.max(0, nv);
      if (Math.random() < pDawdle) nv = Math.max(0, nv - Math.random() * DAWDLE_KICK);
      if (t < brakeUntil[i]) nv = 0;

      // A car at a standstill waits out START_DELAY once the road ahead opens.
      // The clock only runs while it could actually move, so a car still boxed
      // in by the one in front is not quietly serving its wait.
      if (vs[i] >= CREEP || nv <= 0) {
        readyAt[i] = 0;
      } else {
        if (readyAt[i] === 0) readyAt[i] = t + START_DELAY;
        if (t < readyAt[i]) nv = 0;
      }

      newVs[i] = nv;
    }
    for (i = 0; i < n; i++) {
      vs[i] = newVs[i];
      xs[i] = (xs[i] + vs[i] * dt) % L;
    }

    // Safety pass: walk backwards from the car with the widest gap ahead,
    // clamping each car behind its (already final) leader. Krauss speeds are
    // near collision-free, but a forced frenazo can violate them.
    if (n > 1) {
      var anchor = 0, widest = -1;
      for (i = 0; i < n; i++) {
        g = gapAhead(i);
        if (g > widest) { widest = g; anchor = i; }
      }
      for (var k = 1; k < n; k++) {
        i = (anchor - k + n) % n;
        j = (i + 1) % n;
        if (gapAhead(i) < MIN_GAP) {
          xs[i] = (xs[j] - CAR_LEN - MIN_GAP + L * 2) % L;
          vs[i] = Math.min(vs[i], vs[j]);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  // Speeds are measured against freeSpeed(), which holds still while the
  // traffic moves: a car's colour therefore changes only when that car's own
  // speed does, and the ramp spans the range of speeds this density actually
  // produces.
  function speedColor(v) {
    var ref = freeSpeed();
    var a, b_, t;
    if (v > ref) {
      // Above the equilibrium — a car flooring it into the gap a jam leaves
      // behind. Blue saturates ESCAPE_SPAN above the equilibrium, roughly the
      // most a car gains while escaping a queue. The span is also capped by
      // the speed limit, so on a road empty enough that the limit *is* the
      // equilibrium there is no headroom and nothing turns blue: with no
      // queue to escape there is nothing to mark.
      var head = Math.min(vmaxMs() - ref, ref * ESCAPE_SPAN);
      a = GREEN; b_ = BLUE;
      t = head > 0.1 ? Math.min(1, (v - ref) / head) : 0;
    } else {
      var f = Math.max(0, v / ref);
      if (f < 0.5) { a = RED; b_ = AMBER; t = f * 2; }
      else { a = AMBER; b_ = GREEN; t = (f - 0.5) * 2; }
    }
    return 'rgb(' +
      Math.round(a.r + (b_.r - a.r) * t) + ',' +
      Math.round(a.g + (b_.g - a.g) * t) + ',' +
      Math.round(a.b + (b_.b - a.b) * t) + ')';
  }

  function angleOf(x) { return x / L * 2 * Math.PI - Math.PI / 2; }

  function drawRoad() {
    var w = roadCanvas.width, h = roadCanvas.height;
    roadCtx.clearRect(0, 0, w, h);

    roadCtx.beginPath();
    roadCtx.arc(CX, CY, R, 0, 2 * Math.PI);
    roadCtx.lineWidth = ROAD_W;
    roadCtx.strokeStyle = '#f1f1f1';
    roadCtx.stroke();
    roadCtx.lineWidth = 1;
    roadCtx.strokeStyle = '#e2e2e2';
    roadCtx.beginPath();
    roadCtx.arc(CX, CY, R - ROAD_W / 2, 0, 2 * Math.PI);
    roadCtx.stroke();
    roadCtx.beginPath();
    roadCtx.arc(CX, CY, R + ROAD_W / 2, 0, 2 * Math.PI);
    roadCtx.stroke();

    // Cars: small tangent rectangles, slightly longer than to scale so they
    // stay visible; colour comes from the speed ramp.
    var carPx = Math.max(9, CAR_LEN / L * 2 * Math.PI * R);
    for (var i = 0; i < xs.length; i++) {
      var a = angleOf(xs[i]);
      roadCtx.save();
      roadCtx.translate(CX + R * Math.cos(a), CY + R * Math.sin(a));
      roadCtx.rotate(a + Math.PI / 2);
      roadCtx.fillStyle = speedColor(vs[i]);
      roadCtx.beginPath();
      if (roadCtx.roundRect) {
        roadCtx.roundRect(-carPx / 2, -7, carPx, 14, 3);
      } else {
        roadCtx.rect(-carPx / 2, -7, carPx, 14);
      }
      roadCtx.fill();
      roadCtx.restore();
    }
  }

  // One pixel row per ST_ROW of simulated time; old rows scroll up, so time
  // flows downward.
  function drawSpacetimeRow() {
    var w = stCanvas.width, h = stCanvas.height;
    stCtx.drawImage(stCanvas, 0, -1);
    stCtx.fillStyle = '#ffffff';
    stCtx.fillRect(0, h - 1, w, 1);
    for (var i = 0; i < xs.length; i++) {
      stCtx.fillStyle = speedColor(vs[i]);
      stCtx.fillRect(Math.round(xs[i] / L * w), h - 1, 2, 1);
    }
  }

  var statSpeed = el('stat-speed');
  var statStopped = el('stat-stopped');

  function updateStats() {
    var sum = 0, stopped = 0;
    for (var i = 0; i < vs.length; i++) {
      sum += vs[i];
      if (vs[i] < 2) stopped++;
    }
    statSpeed.textContent = Math.round(sum / vs.length * 3.6) + ' km/h';
    statStopped.textContent = String(stopped);
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  function forceBrake(i) {
    brakeUntil[i] = t + BRAKE_HOLD;
    vs[i] = 0;
  }

  brakeBtn.addEventListener('click', function () {
    forceBrake(Math.floor(Math.random() * xs.length));
  });

  roadCanvas.addEventListener('click', function (ev) {
    var rect = roadCanvas.getBoundingClientRect();
    var px = (ev.clientX - rect.left) * roadCanvas.width / rect.width;
    var py = (ev.clientY - rect.top) * roadCanvas.height / rect.height;
    var a = Math.atan2(py - CY, px - CX);
    var pos = ((a + Math.PI / 2) / (2 * Math.PI) * L + L) % L;
    var best = 0, bestDist = Infinity;
    for (var i = 0; i < xs.length; i++) {
      var d = Math.abs(xs[i] - pos);
      d = Math.min(d, L - d);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    forceBrake(best);
  });

  runBtn.addEventListener('click', function () {
    running = !running;
    runBtn.textContent = running ? 'Pausa' : 'Sigue';
  });

  resetBtn.addEventListener('click', function () {
    init();
    drawRoad();
    updateStats();
  });

  carsInput.addEventListener('input', function () {
    el('cars-val').textContent = carsInput.value;
    init();
  });
  dawdleInput.addEventListener('input', function () {
    el('dawdle-val').textContent = dawdleInput.value + '%';
  });
  vmaxInput.addEventListener('input', function () {
    el('vmax-val').textContent = vmaxInput.value + ' km/h';
  });

  var lastFrame = 0;
  var stAccum = 0;   // simulated time owed to the space-time diagram
  var statAccum = 0;

  function frame(now) {
    // Advance by the wall-clock time since the last frame. The cap bounds a
    // single step: a backgrounded tab or a long pause reports a huge elapsed
    // time, and one step that size would fling cars through the ones ahead.
    // Heavy load therefore renders in slow motion.
    if (!lastFrame) lastFrame = now;
    var elapsed = (now - lastFrame) / 1000;
    lastFrame = now;

    if (running) {
      var dt = Math.min(elapsed * TIME_SCALE, DT_MAX);
      step(dt);
      drawRoad();

      // Rows are emitted on simulated time, so the slope of the jam bands
      // means the same thing on every display.
      stAccum += dt;
      if (stAccum >= ST_ROW) {
        stAccum -= ST_ROW;
        drawSpacetimeRow();
      }
      statAccum += dt;
      if (statAccum >= STAT_EVERY) {
        statAccum = 0;
        updateStats();
      }
    }
    requestAnimationFrame(frame);
  }

  init();
  drawRoad();
  updateStats();
  requestAnimationFrame(frame);
})();
