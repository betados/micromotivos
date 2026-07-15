/* Hotelling with several vendors — vanilla JS, no dependencies.
 *
 * The two-vendor widget (hotelling.js) is deliberately left alone, which is why
 * the share maths below is a second copy rather than a shared import. If the two
 * ever need to agree on a rule change, lift the pure functions into a shared
 * file and load it from both pages.
 *
 * Every vendor is a bot. They move strictly in turns — one walks to the best
 * spot it can see, then the next. That turn-taking is not just for looks: when
 * they all shuffle at once they chase each other's stale positions and never
 * converge, even for vendor counts that provably have a resting layout.
 *
 * Two vendors come to rest in the middle; four pair up on ¼ and ¾. Three never
 * come to rest at all — there is no arrangement of three where nobody wants to
 * move, so the loop below genuinely never terminates. That is the widget's whole
 * point, not a bug: do not "fix" it with a settling threshold.
 *
 * The cap of four is deliberate. Five vendors do have a resting layout
 * (⅙, ⅙, ½, ⅚, ⅚), but vendors this myopic never find it — they fall into a
 * cycle. Showing that would imply "five has no equilibrium", which is false.
 */
(function () {
  'use strict';

  var MINV = 2, MAXV = 4, START_N = 3;

  var GAP = 0.012;      // how close a vendor parks beside another
  var SPEED = 0.30;     // beach fractions per second
  var PAUSE = 260;      // ms beat between one vendor's turn and the next
  // Ignore improvements smaller than this. A vendor boxed in between two others
  // earns the same wherever it stands, so without a margin it would twitch every
  // turn chasing rounding noise. It must stay far below a real move's payoff —
  // those are worth tenths of the beach — or it would invent a resting layout
  // where the maths says none exists.
  var MARGIN = 0.002;

  // --- Model (pure) ------------------------------------------------------

  // Bathers walk to the nearest cart, so the vendors carve the beach at the
  // midpoints between neighbours. Carts sharing a spot split the customers
  // nearest to it, and are drawn an equal band each so the picture matches the
  // count.
  function territories(pos) {
    var n = pos.length, i;
    var order = [];
    for (i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return pos[a] - pos[b] || a - b; });

    var groups = [];
    for (i = 0; i < order.length; i++) {
      var last = groups[groups.length - 1];
      if (last && last.p === pos[order[i]]) last.members.push(order[i]);
      else groups.push({ p: pos[order[i]], members: [order[i]] });
    }

    var out = new Array(n);
    for (var g = 0; g < groups.length; g++) {
      var lo = g === 0 ? 0 : (groups[g - 1].p + groups[g].p) / 2;
      var hi = g === groups.length - 1 ? 1 : (groups[g].p + groups[g + 1].p) / 2;
      var members = groups[g].members.slice().sort(function (a, b) { return a - b; });
      var w = (hi - lo) / members.length;
      for (var m = 0; m < members.length; m++) {
        out[members[m]] = { lo: lo + m * w, hi: lo + (m + 1) * w, share: w };
      }
    }
    return out;
  }

  function shareOf(pos, i) { return territories(pos)[i].share; }
  function clamp(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  // Where vendor i would sell most, given where everyone else is standing. Its
  // takings only bend at the other carts, so the best spot is always hard against
  // one of them, or at an end of the beach.
  //
  // pos[j] itself must be a candidate, not merely pos[j] ± GAP: with four vendors
  // the resting layout pairs carts on the very same spot (¼, ¼, ¾, ¾). A vendor
  // that may only park *beside* another can never reach it, and the beach would
  // never come to rest.
  function bestSpot(pos, i) {
    var best = pos[i], bestVal = shareOf(pos, i);
    var cands = [0, 1];
    for (var j = 0; j < pos.length; j++) {
      if (j === i) continue;
      cands.push(pos[j], clamp(pos[j] - GAP), clamp(pos[j] + GAP));
    }
    var trial = pos.slice();
    for (var c = 0; c < cands.length; c++) {
      trial[i] = cands[c];
      var v = shareOf(trial, i);
      if (v > bestVal + MARGIN) { bestVal = v; best = cands[c]; }
    }
    return best;
  }

  // Where the bathers would put them: evenly spread, 1/n of the beach each.
  function idealPositions(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push((2 * i + 1) / (2 * n));
    return out;
  }

  // --- View --------------------------------------------------------------

  var X0 = 50, SPAN = 500;
  function px(t) { return X0 + SPAN * t; }
  var MIN_SEP = 22;

  // Carts pile onto the same spot at rest (four settle as two pairs), so fan any
  // cluster out around its true centre. Only the drawing moves — every share and
  // boundary comes from the real positions.
  function spread(xs) {
    var out = xs.slice(), i = 0, k;
    while (i < out.length) {
      var j = i;
      while (j + 1 < out.length && out[j + 1] - out[j] < MIN_SEP) j++;
      if (j > i) {
        var mean = 0;
        for (k = i; k <= j; k++) mean += xs[k];
        mean /= (j - i + 1);
        var start = mean - ((j - i) * MIN_SEP) / 2;
        for (k = i; k <= j; k++) out[k] = start + (k - i) * MIN_SEP;
      }
      i = j + 1;
    }
    // A fanned cluster can now bump the next cart along; nudge right if so.
    for (k = 1; k < out.length; k++) {
      if (out[k] - out[k - 1] < MIN_SEP) out[k] = out[k - 1] + MIN_SEP;
    }
    var over = out[out.length - 1] - 590;
    if (over > 0) for (k = 0; k < out.length; k++) out[k] -= over;
    var under = 10 - out[0];
    if (under > 0) for (k = 0; k < out.length; k++) out[k] += under;
    return out;
  }

  var el = function (id) { return document.getElementById(id); };
  var countOut = el('hn-count');
  var lessBtn = el('hn-less');
  var moreBtn = el('hn-more');
  var resetBtn = el('hn-reset');
  var msgMoving = el('hn-msg-moving');
  var msgRest = el('hn-msg-rest');
  var clockOut = el('hn-clock');
  var restedOut = el('hn-rested');

  var terrs = [], carts = [], chips = [], shares = [], bounds = [];
  for (var v = 1; v <= MAXV; v++) {
    terrs.push(el('hn-terr-' + v));
    carts.push(el('hn-cart-' + v));
    chips.push(el('hn-chip-' + v));
    shares.push(el('hn-share-' + v));
    if (v < MAXV) bounds.push(el('hn-bound-' + v));
  }

  // --- State -------------------------------------------------------------

  var n = START_N;
  var pos = [], target = [];
  var turn = 0, phase = 'walk', waitUntil = 0, still = 0;
  var raf = null, last = 0, startedAt = 0, restedAt = 0;
  var settled = false, lastKey = '';

  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }
  function secs(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }

  function render() {
    var t = territories(pos);
    var i, order = [];
    for (i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return pos[a] - pos[b] || a - b; });

    var xs = spread(order.map(function (idx) { return px(pos[idx]); }));

    for (i = 0; i < MAXV; i++) {
      var on = i < n;
      carts[i].setAttribute('visibility', on ? 'visible' : 'hidden');
      chips[i].style.display = on ? '' : 'none';
      if (!on) { terrs[i].setAttribute('width', 0); continue; }
      terrs[i].setAttribute('x', px(t[i].lo));
      terrs[i].setAttribute('width', SPAN * (t[i].hi - t[i].lo));
      shares[i].textContent = pct(t[i].share);
    }
    for (i = 0; i < order.length; i++) {
      carts[order[i]].setAttribute('transform', 'translate(' + xs[i] + ',0)');
    }
    for (i = 0; i < bounds.length; i++) {
      if (i < n - 1) {
        var at = px(t[order[i]].hi);
        bounds[i].setAttribute('x1', at);
        bounds[i].setAttribute('x2', at);
        bounds[i].setAttribute('visibility', 'visible');
      } else {
        bounds[i].setAttribute('visibility', 'hidden');
      }
    }
    countOut.textContent = n;
    lessBtn.disabled = n <= MINV;
    moreBtn.disabled = n >= MAXV;
  }

  function tell(now) {
    if (!settled) {
      // The clock is the argument: with three vendors it never stops climbing.
      clockOut.textContent = secs(now - startedAt);
      if (lastKey !== 'moving') {
        lastKey = 'moving';
        msgMoving.classList.remove('off');
        msgRest.classList.add('off');
      }
      return;
    }
    if (lastKey === 'rest') return;
    lastKey = 'rest';
    restedOut.textContent = secs(restedAt - startedAt);
    msgRest.classList.remove('off');
    msgMoving.classList.add('off');
  }

  // --- Turns -------------------------------------------------------------

  // Hand the turn to whoever wants to move. If nobody does after a full lap,
  // the beach is at rest and the loop can stop.
  function beginTurn() {
    for (var guard = 0; guard <= n; guard++) {
      target[turn] = bestSpot(pos, turn);
      if (target[turn] !== pos[turn]) { still = 0; phase = 'walk'; return; }
      still += 1;
      if (still >= n) { settled = true; return; }
      turn = (turn + 1) % n;
    }
    settled = true;
  }

  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (phase === 'walk') {
      var d = target[turn] - pos[turn];
      var step = SPEED * dt;
      if (Math.abs(d) <= step) {
        pos[turn] = target[turn];
        phase = 'wait';
        waitUntil = now + PAUSE;
      } else {
        pos[turn] += d > 0 ? step : -step;
      }
    } else if (now >= waitUntil) {
      turn = (turn + 1) % n;
      beginTurn();
      if (settled) restedAt = now;
    }

    render();
    tell(now);
    raf = settled ? null : requestAnimationFrame(loop);
  }

  function start(newN, now) {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    n = newN;
    pos = idealPositions(n);
    target = pos.slice();
    turn = 0;
    still = 0;
    settled = false;
    lastKey = '';
    last = now;
    startedAt = now;
    restedAt = now;
    beginTurn();
    if (settled) restedAt = now;
    render();
    tell(now);
    if (!settled) raf = requestAnimationFrame(loop);
  }

  lessBtn.addEventListener('click', function () {
    if (n > MINV) start(n - 1, performance.now());
  });
  moreBtn.addEventListener('click', function () {
    if (n < MAXV) start(n + 1, performance.now());
  });
  resetBtn.addEventListener('click', function () {
    start(n, performance.now());
  });

  start(START_N, performance.now());
})();
