/* Hotelling on a square beach — vanilla JS, no dependencies.
 *
 * The 1-D widgets (hotelling.js, hotelling-n.js) are deliberately left alone, so
 * the share maths here is a third implementation rather than a shared import.
 * It is genuinely different maths — areas of Voronoi cells rather than lengths of
 * intervals — but bestSpot and the turn-taking are the same idea. If these ever
 * need to agree on a rule change, lift the shared parts into one file.
 *
 * You own vendor 1; the rest are bots that take turns walking to wherever they
 * would sell most. Bathers fill the square evenly and buy from the nearest cart,
 * so the vendors carve the square into Voronoi cells.
 *
 * Coordinates: the beach is the unit square, and beach (0,0) is the SVG's
 * top-left corner of the square. No axis is flipped anywhere — the square is
 * symmetric, nothing depends on which way is "up", and a flip would only be a
 * chance to get the pointer mapping wrong.
 */
(function () {
  'use strict';

  var MINV = 2, MAXV = 4, START_N = 3;

  var SPEED = 0.30;     // square-widths per second a bot walks
  var PAUSE = 240;      // ms beat between one bot's turn and the next
  var MARGIN = 0.002;   // ignore improvements smaller than this (anti-jitter)
  var GRID = 24;        // coarse search resolution for a bot's best spot
  var STEPS = 100;      // positions your own cart snaps to, per axis
  var MAGNET = 0.015;   // ...plus a pull onto the exact centre

  var SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]];

  // --- Model (pure) ------------------------------------------------------

  function same(a, b) { return a[0] === b[0] && a[1] === b[1]; }

  // Keep the part of poly that is closer to a than to b — i.e. clip against the
  // perpendicular bisector of ab (Sutherland–Hodgman).
  function clipToward(poly, a, b) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    function f(p) { return (p[0] - mx) * dx + (p[1] - my) * dy; }
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var P = poly[i], Q = poly[(i + 1) % poly.length];
      var fp = f(P), fq = f(Q);
      if (fp <= 0) out.push(P);
      if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
        var t = fp / (fp - fq);
        out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
      }
    }
    return out;
  }

  function area(poly) {
    var s = 0;
    for (var i = 0; i < poly.length; i++) {
      var P = poly[i], Q = poly[(i + 1) % poly.length];
      s += P[0] * Q[1] - Q[0] * P[1];
    }
    return Math.abs(s) / 2;
  }

  // Vendor i's patch of square, and the slice of trade it brings. Carts sharing a
  // spot cannot be separated by a bisector — every bather is equidistant — so
  // they share the cell and split its custom evenly.
  function cellOf(pos, i) {
    var poly = SQUARE, members = 1;
    for (var j = 0; j < pos.length; j++) {
      if (j === i) continue;
      if (same(pos[i], pos[j])) { members += 1; continue; }
      poly = clipToward(poly, pos[i], pos[j]);
      if (!poly.length) return { poly: [], share: 0 };
    }
    return { poly: poly, share: area(poly) / members };
  }

  function cells(pos) {
    var out = [];
    for (var i = 0; i < pos.length; i++) out.push(cellOf(pos, i));
    return out;
  }

  function clamp(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  // Where vendor i would sell most, given where everyone else stands. In one
  // dimension the best spot was always hard against a neighbour, so a handful of
  // candidates sufficed; on a plane there is no such shortlist, so sweep a grid
  // and then walk downhill from the winner.
  //
  // The other vendors' exact spots must be candidates: standing on someone splits
  // their trade evenly, and that is precisely the resting position for two carts
  // in the middle. A bot that may only stand *beside* you could never tie.
  function bestSpot(pos, i) {
    var trial = pos.slice();
    var best = pos[i], bestVal = cellOf(pos, i).share;

    function tryAt(x, y) {
      var c = [clamp(x), clamp(y)];
      trial[i] = c;
      var v = cellOf(trial, i).share;
      if (v > bestVal + MARGIN) { bestVal = v; best = c; }
    }

    for (var gx = 0; gx <= GRID; gx++) {
      for (var gy = 0; gy <= GRID; gy++) tryAt(gx / GRID, gy / GRID);
    }
    for (var j = 0; j < pos.length; j++) {
      if (j !== i) tryAt(pos[j][0], pos[j][1]);
    }

    // Refine: the grid only locates the right neighbourhood.
    var span = 1 / GRID;
    for (var r = 0; r < 4; r++) {
      var cx = best[0], cy = best[1];
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          if (dx || dy) tryAt(cx + dx * span, cy + dy * span);
        }
      }
      span /= 2;
    }
    return best;
  }

  // Where the bathers would want them: spread out, none of them crowding.
  function startPositions(n) {
    if (n === 2) return [[0.3, 0.5], [0.7, 0.5]];
    if (n === 3) return [[0.3, 0.3], [0.7, 0.3], [0.5, 0.72]];
    return [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]];
  }

  // --- View --------------------------------------------------------------

  var X0 = 30, Y0 = 30, SPAN = 300;
  function pxX(t) { return X0 + SPAN * t; }
  function pxY(t) { return Y0 + SPAN * t; }
  var MIN_SEP = 20;

  function pathOf(poly) {
    if (!poly.length) return '';
    var d = 'M' + pxX(poly[0][0]).toFixed(2) + ',' + pxY(poly[0][1]).toFixed(2);
    for (var i = 1; i < poly.length; i++) {
      d += 'L' + pxX(poly[i][0]).toFixed(2) + ',' + pxY(poly[i][1]).toFixed(2);
    }
    return d + 'Z';
  }

  // Two carts on the same spot would draw on top of each other. Fan any huddle
  // out sideways around its true centre. Only the markers move; every share and
  // every cell edge comes from the real positions.
  function markerPositions(pos) {
    var pts = pos.map(function (p) { return [pxX(p[0]), pxY(p[1])]; });
    var out = pts.map(function (p) { return p.slice(); });
    var taken = [], i, j;
    for (i = 0; i < pts.length; i++) {
      if (taken[i]) continue;
      var group = [i];
      taken[i] = true;
      for (j = i + 1; j < pts.length; j++) {
        var dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
        if (!taken[j] && Math.sqrt(dx * dx + dy * dy) < MIN_SEP) {
          group.push(j);
          taken[j] = true;
        }
      }
      if (group.length < 2) continue;
      // Fan them out in the order they actually stand, not the order they happen
      // to be stored in: spreading by index can place a cart on the wrong side of
      // its neighbour, so the picture would contradict the territories under it.
      group.sort(function (a, b) {
        return pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1] || a - b;
      });
      var mx = 0, my = 0;
      for (j = 0; j < group.length; j++) { mx += pts[group[j]][0]; my += pts[group[j]][1]; }
      mx /= group.length; my /= group.length;
      var start = mx - ((group.length - 1) * MIN_SEP) / 2;
      for (j = 0; j < group.length; j++) out[group[j]] = [start + j * MIN_SEP, my];
    }
    return out;
  }

  // Cells for *drawing*. One case has to be exact rather than approximate: two
  // carts resting on the very same spot in the middle, which is the whole point
  // of the square. Their shared cell is the entire square, so split it down the
  // middle — the halves are honestly 50/50, and which bather is served by which
  // of two carts standing on one spot was never defined anyway. Fleeting overlaps
  // while three or four bots chase each other are left to draw on top of each
  // other; they last a few frames and the shares below stay right regardless.
  function drawCells(pos, cs) {
    if (pos.length === 2 && same(pos[0], pos[1])) {
      return [[[0, 0], [0.5, 0], [0.5, 1], [0, 1]],
              [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]];
    }
    return cs.map(function (c) { return c.poly; });
  }

  var el = function (id) { return document.getElementById(id); };
  var svg = el('hd-beach');
  var countOut = el('hd-count');
  var lessBtn = el('hd-less');
  var moreBtn = el('hd-more');
  var resetBtn = el('hd-reset');
  var howto = el('hd-howto');
  var msgMoving = el('hd-msg-moving');
  var msgRest = el('hd-msg-rest');

  var cellEls = [], carts = [], chips = [], shares = [];
  for (var v = 1; v <= MAXV; v++) {
    cellEls.push(el('hd-cell-' + v));
    carts.push(el('hd-cart-' + v));
    chips.push(el('hd-chip-' + v));
    shares.push(el('hd-share-' + v));
  }

  // --- State -------------------------------------------------------------

  var n = START_N;
  var pos = [], target = null;
  var turn = 1, phase = 'wait', waitUntil = 0, still = 0;
  var raf = null, last = 0, settled = false, lastKey = '';
  var dragging = false, touched = false;

  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }

  function setYou(p, magnet) {
    var x = Math.round(clamp(p[0]) * STEPS) / STEPS;
    var y = Math.round(clamp(p[1]) * STEPS) / STEPS;
    // The centre is the one spot on a square worth landing on exactly.
    if (magnet && Math.abs(x - 0.5) <= MAGNET && Math.abs(y - 0.5) <= MAGNET) {
      x = 0.5; y = 0.5;
    }
    pos[0] = [x, y];
  }

  function beachAt(evt) {
    var ctm = svg.getScreenCTM();
    if (!ctm) return pos[0];
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    var p = pt.matrixTransform(ctm.inverse());
    return [(p.x - X0) / SPAN, (p.y - Y0) / SPAN];
  }

  function render() {
    var cs = cells(pos);
    var polys = drawCells(pos, cs);
    var marks = markerPositions(pos);
    for (var i = 0; i < MAXV; i++) {
      var on = i < n;
      carts[i].setAttribute('visibility', on ? 'visible' : 'hidden');
      chips[i].style.display = on ? '' : 'none';
      cellEls[i].setAttribute('d', on ? pathOf(polys[i]) : '');
      if (!on) continue;
      carts[i].setAttribute('transform', 'translate(' + marks[i][0].toFixed(2) +
        ',' + marks[i][1].toFixed(2) + ')');
      shares[i].textContent = pct(cs[i].share);
    }
    countOut.textContent = n;
    lessBtn.disabled = n <= MINV;
    moreBtn.disabled = n >= MAXV;
  }

  function tell() {
    var key = settled ? 'rest' : 'moving';
    if (key === lastKey) return;
    lastKey = key;
    msgRest.classList.toggle('off', key !== 'rest');
    msgMoving.classList.toggle('off', key !== 'moving');
  }

  // --- Turns (bots only; vendor 1 is yours) -------------------------------

  function beginTurn() {
    if (n < 2) { settled = true; return; }
    for (var guard = 0; guard < n; guard++) {
      target = bestSpot(pos, turn);
      if (!same(target, pos[turn])) { still = 0; phase = 'walk'; return; }
      still += 1;
      if (still >= n - 1) { settled = true; return; }
      turn = turn + 1 >= n ? 1 : turn + 1;
    }
    settled = true;
  }

  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (phase === 'walk') {
      var dx = target[0] - pos[turn][0], dy = target[1] - pos[turn][1];
      var dist = Math.sqrt(dx * dx + dy * dy);
      var step = SPEED * dt;
      if (dist <= step) {
        pos[turn] = target.slice();
        phase = 'wait';
        waitUntil = now + PAUSE;
      } else {
        pos[turn] = [pos[turn][0] + (dx / dist) * step, pos[turn][1] + (dy / dist) * step];
      }
    } else if (now >= waitUntil) {
      turn = turn + 1 >= n ? 1 : turn + 1;
      beginTurn();
    }

    render();
    tell();
    raf = settled ? null : requestAnimationFrame(loop);
  }

  function kick() {
    settled = false;
    still = 0;
    tell();
    if (raf === null) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function start(newN) {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    n = newN;
    pos = startPositions(n);
    turn = 1;
    still = 0;
    settled = false;
    lastKey = '';
    phase = 'walk';
    beginTurn();
    render();
    tell();
    if (!settled) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  // --- Input -------------------------------------------------------------

  function wake() {
    if (touched) return;
    touched = true;
    howto.setAttribute('visibility', 'hidden');
  }

  svg.addEventListener('pointerdown', function (e) {
    dragging = true;
    if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
    wake();
    setYou(beachAt(e), true);
    render();
    kick();
    e.preventDefault();
  });

  svg.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    setYou(beachAt(e), true);
    render();
    kick();
    e.preventDefault();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (svg.releasePointerCapture && svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) {
      svg.releasePointerCapture(e.pointerId);
    }
    kick();
  }

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  svg.addEventListener('keydown', function (e) {
    var p = pos[0].slice();
    if (e.key === 'ArrowLeft') p[0] -= 1 / STEPS;
    else if (e.key === 'ArrowRight') p[0] += 1 / STEPS;
    else if (e.key === 'ArrowUp') p[1] -= 1 / STEPS;
    else if (e.key === 'ArrowDown') p[1] += 1 / STEPS;
    else return;
    wake();
    setYou(p, false);
    render();
    kick();
    e.preventDefault();
  });

  lessBtn.addEventListener('click', function () { if (n > MINV) start(n - 1); });
  moreBtn.addEventListener('click', function () { if (n < MAXV) start(n + 1); });
  resetBtn.addEventListener('click', function () { start(n); });

  start(START_N);
})();
