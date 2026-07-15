/* Hotelling's ice-cream vendors — vanilla JS, no dependencies. */
(function () {
  'use strict';

  // The beach is the interval [0,1]. Bathers walk to the nearest cart, so two
  // vendors always split the beach at the midpoint between them.

  // How close the rival parks beside you. Purely cosmetic: the real best reply
  // is "infinitesimally closer to the centre", which would draw as an overlap.
  var GAP = 0.012;

  var REACTION = 450;   // ms before the rival notices you have moved
  var SPEED = 0.32;     // beach fractions per second the rival walks
  var STEPS = 200;      // positions your cart can take along the beach
  var MAGNET = 0.01;    // ...plus a pull onto the exact centre, which is 1 step wide

  var START_YOU = 0.25, START_RIVAL = 0.75;

  // --- Model (pure) ------------------------------------------------------

  function share(you, rival) {
    if (you === rival) return 0.5;
    var mid = (you + rival) / 2;
    return you < rival ? mid : 1 - mid;
  }

  // The rival's best reply: park beside you, on whichever side holds more
  // beach. Never step past the centre — overshooting would hand you the bigger
  // half — so against a cart already at ½ the rival can only match it.
  function bestResponse(you) {
    return you < 0.5
      ? you + Math.min(GAP, 0.5 - you)
      : you - Math.min(GAP, you - 0.5);
  }

  // --- View --------------------------------------------------------------

  var X0 = 50, SPAN = 500;              // beach spans x=50..550 in the viewBox
  function px(t) { return X0 + SPAN * t; }

  // Two carts a hair apart — or, at ½, on the very same spot — would draw on top
  // of each other. Shove the glyphs outward so they read as back to back, the
  // way the third schema draws them. Only the drawing moves: the split and the
  // shares always come from the true positions.
  var MIN_SEP = 22;

  function glyphPositions(you, rival) {
    var xYou = px(you), xRival = px(rival);
    var gap = Math.abs(xRival - xYou);
    if (gap >= MIN_SEP) return [xYou, xRival];
    var push = (MIN_SEP - gap) / 2;
    return you <= rival
      ? [xYou - push, xRival + push]
      : [xYou + push, xRival - push];
  }

  var el = function (id) { return document.getElementById(id); };
  var svg = el('hg-beach');
  var terrYou = el('hg-terr-you');
  var terrRival = el('hg-terr-rival');
  var boundary = el('hg-boundary');
  var youG = el('hg-you');
  var rivalG = el('hg-rival');
  var shareYou = el('hg-share-you');
  var shareRival = el('hg-share-rival');
  var posVal = el('hg-pos-val');
  var resetBtn = el('hg-reset');
  var verdict = el('hg-verdict');
  var verdictBody = el('hg-verdict-body');
  var howto = el('hg-howto');

  // --- State -------------------------------------------------------------

  var you = START_YOU;
  var rival = START_RIVAL;
  var trail = [];       // {t, p} samples of your position — the rival's reaction lag
  var dragging = false;
  var awake = false;    // the rival holds still at ¾ until you first touch the beach
  var raf = null;
  var last = 0;
  var lastKey = '';
  var loseCount = 0;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(t) { return t.toFixed(2).replace('.', ','); }
  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }

  function setYou(t, magnet) {
    t = Math.round(clamp(t, 0, 1) * STEPS) / STEPS;
    // The centre is the only spot worth landing on exactly, and it is one step
    // wide. Pull the pointer onto it; the arrow keys pass magnet=false so they
    // can still walk back off it.
    if (magnet && Math.abs(t - 0.5) <= MAGNET) t = 0.5;
    you = t;
  }

  function beachAt(evt) {
    var ctm = svg.getScreenCTM();
    if (!ctm) return you;
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    var p = pt.matrixTransform(ctm.inverse());
    return (p.x - X0) / SPAN;
  }

  // --- Drawing -----------------------------------------------------------

  function drawTerritories() {
    var mid = (you + rival) / 2;
    var left = you <= rival ? terrYou : terrRival;
    var right = left === terrYou ? terrRival : terrYou;
    left.setAttribute('x', px(0));
    left.setAttribute('width', SPAN * mid);
    right.setAttribute('x', px(mid));
    right.setAttribute('width', SPAN * (1 - mid));
    boundary.setAttribute('x1', px(mid));
    boundary.setAttribute('x2', px(mid));
  }

  function render() {
    var xs = glyphPositions(you, rival);
    youG.setAttribute('transform', 'translate(' + xs[0] + ',0)');
    rivalG.setAttribute('transform', 'translate(' + xs[1] + ',0)');
    drawTerritories();
    var mine = share(you, rival);
    shareYou.textContent = pct(mine);
    shareRival.textContent = pct(1 - mine);
    posVal.textContent = num(you);
  }

  function say(html, kind) {
    verdictBody.innerHTML = html;
    verdict.className = 'verdict' + (kind ? ' ' + kind : '');
  }

  // --- Copy --------------------------------------------------------------

  // The opening line is authored in the fragment, next to the rest of the
  // widget's copy — read it here rather than keeping a second copy in sync.
  var INTRO = verdictBody.innerHTML;

  function movingMsg() {
    return 'Tu rival te ha visto y viene hacia ti…';
  }

  function tieMsg() {
    return '<strong>Empate: 50% y 50%.</strong> Tu rival se ha puesto a tu lado ' +
      'y no ha podido hacer nada mejor: mires donde mires, no hay un lado ancho ' +
      'que robarte. Es el único sitio de la playa donde no pierdes — y por eso ' +
      'los dos acabáis aquí. Mira el precio que pagan los bañistas de los ' +
      'extremos: media playa andando.';
  }

  function loseMsg(mine, wide, hint) {
    var msg =
      '<strong>Pierdes: ' + pct(mine) + ' contra ' + pct(1 - mine) + '.</strong> ' +
      'Se ha plantado pegado a ti por la ' + wide + ', que es donde queda más ' +
      'playa, y se ha quedado con todo ese lado.';
    if (hint) {
      msg += ' <em>Pista: ¿hay algún punto donde no le dejes un lado más ancho ' +
        'que el otro?</em>';
    }
    return msg;
  }

  // The verdict box is the last thing on the page, so a short message following
  // a long one shortens the document and jogs the scroll position under the
  // reader. Hold the box open at the height of the wordiest thing it can ever
  // say. Measured rather than hard-coded, so it stays right when the copy is
  // reworded or the window is resized.
  function reserveHeight() {
    // Measure on a copy: writing the samples through the real box would make a
    // screen reader announce every one of them at the live region.
    var probe = verdict.cloneNode(true);
    probe.removeAttribute('id');
    probe.removeAttribute('role');
    probe.className = 'verdict';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.minHeight = '0';
    probe.style.width = verdict.offsetWidth + 'px';
    var body = probe.firstElementChild;
    body.removeAttribute('id');          // no duplicate ids, however briefly
    verdict.parentNode.appendChild(probe);

    var samples = [INTRO, movingMsg(), tieMsg(), loseMsg(0.306, 'izquierda', true)];
    var tallest = 0;
    for (var i = 0; i < samples.length; i++) {
      body.innerHTML = samples[i];
      if (probe.offsetHeight > tallest) tallest = probe.offsetHeight;
    }
    probe.parentNode.removeChild(probe);
    verdict.style.minHeight = tallest + 'px';
  }

  function tell(settled) {
    var key;
    if (!awake) key = 'start';
    else if (!settled) key = 'moving';
    else if (you === 0.5) key = 'tie';
    else key = 'lose:' + you;
    if (key === lastKey) return;
    var wasMoving = lastKey === 'moving';
    lastKey = key;

    if (key === 'start') { say(INTRO); return; }
    if (key === 'moving') { say(movingMsg()); return; }
    if (key === 'tie') { say(tieMsg(), 'ok'); return; }

    if (wasMoving) loseCount += 1;
    var wide = you < 0.5 ? 'derecha' : 'izquierda';
    say(loseMsg(share(you, rival), wide, loseCount >= 3), 'bad');
  }

  // --- Loop --------------------------------------------------------------

  // The rival aims at where you were REACTION ms ago, so it always lags a beat
  // behind your finger instead of being glued to it.
  function laggedYou(now) {
    trail.push({ t: now, p: you });
    var cutoff = now - REACTION;
    while (trail.length > 1 && trail[1].t <= cutoff) trail.shift();
    return trail[0].p;
  }

  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);   // clamp: tab-switch jumps
    last = now;

    var target = bestResponse(laggedYou(now));
    var d = target - rival;
    var stepMax = SPEED * dt;
    rival = Math.abs(d) <= stepMax ? target : rival + (d > 0 ? stepMax : -stepMax);

    render();

    var settled = rival === target && trail[0].p === you;
    tell(settled);

    // Idle once the rival has arrived and the lag has drained — no point
    // burning frames while nothing moves.
    raf = (dragging || !settled) ? requestAnimationFrame(loop) : null;
  }

  function kick() {
    if (raf === null) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  // Called before the first setYou of a fresh round, while `you` still holds the
  // starting spot — seeding the lag buffer with it is what makes the rival take
  // its full reaction time to notice that very first move. Without a seed the
  // buffer is empty, the first frame is the only sample, and the rival lurches
  // off instantly.
  function wake() {
    if (awake) return;
    awake = true;
    howto.setAttribute('visibility', 'hidden');
    trail = [{ t: performance.now(), p: you }];
  }

  // --- Input -------------------------------------------------------------

  svg.addEventListener('pointerdown', function (e) {
    dragging = true;
    if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
    wake();
    setYou(beachAt(e), true);
    kick();
    e.preventDefault();
  });

  svg.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    setYou(beachAt(e), true);
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
    var t;
    if (e.key === 'ArrowLeft') t = you - 1 / STEPS;
    else if (e.key === 'ArrowRight') t = you + 1 / STEPS;
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = 1;
    else return;
    wake();
    setYou(t, false);
    kick();
    e.preventDefault();
  });

  resetBtn.addEventListener('click', function () {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    you = START_YOU;
    rival = START_RIVAL;
    trail = [];
    dragging = false;
    awake = false;
    loseCount = 0;
    lastKey = '';
    howto.setAttribute('visibility', 'visible');
    render();
    tell(true);
  });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reserveHeight, 150);
  });

  render();
  tell(true);
  reserveHeight();
  // Web fonts arrive after first paint and change how the copy wraps.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reserveHeight);
  }
})();
