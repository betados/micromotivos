/* Hotelling's ice-cream vendors — vanilla JS, no dependencies. */
(function () {
  'use strict';

  // The beach is the interval [0,1]. Bathers walk to the nearest cart, so two
  // vendors always split the beach at the midpoint between them.

  // How close the rival parks beside you. Purely cosmetic: the real best reply
  // is "infinitesimally closer to the centre", which would draw as an overlap.
  var GAP = 0.012;

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
  // way the second schema draws them. Only the drawing moves: the split and the
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
  var terrYou = el('hg-terr-you');
  var terrRival = el('hg-terr-rival');
  var boundary = el('hg-boundary');
  var youG = el('hg-you');
  var rivalG = el('hg-rival');
  var shareYou = el('hg-share-you');
  var shareRival = el('hg-share-rival');
  var triesOut = el('hg-tries');
  var posInput = el('hg-pos');
  var posVal = el('hg-pos-val');
  var playBtn = el('hg-play');
  var resetBtn = el('hg-reset');
  var verdict = el('hg-verdict');

  var tries = 0;
  var settled = false;   // true once the rival has answered

  function num(t) { return t.toFixed(2).replace('.', ','); }
  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }

  function youPos() { return parseInt(posInput.value, 10) / 100; }

  function drawTerritories(you, rival) {
    var mid = you === rival ? 0.5 : (you + rival) / 2;
    var left = Math.min(you, rival) === you ? terrYou : terrRival;
    var right = left === terrYou ? terrRival : terrYou;

    left.setAttribute('x', px(0));
    left.setAttribute('width', SPAN * mid);
    right.setAttribute('x', px(mid));
    right.setAttribute('width', SPAN * (1 - mid));
    boundary.setAttribute('x1', px(mid));
    boundary.setAttribute('x2', px(mid));
  }

  function render() {
    var you = youPos();
    posVal.textContent = num(you);

    if (!settled) {
      youG.setAttribute('transform', 'translate(' + px(you) + ',0)');
      terrYou.setAttribute('width', 0);
      terrRival.setAttribute('width', 0);
      rivalG.setAttribute('visibility', 'hidden');
      boundary.setAttribute('visibility', 'hidden');
      shareYou.textContent = '—';
      shareRival.textContent = '—';
      return;
    }

    var rival = bestResponse(you);
    var mine = share(you, rival);
    var xs = glyphPositions(you, rival);

    youG.setAttribute('transform', 'translate(' + xs[0] + ',0)');
    rivalG.setAttribute('transform', 'translate(' + xs[1] + ',0)');
    rivalG.setAttribute('visibility', 'visible');
    boundary.setAttribute('visibility', 'visible');
    drawTerritories(you, rival);

    shareYou.textContent = pct(mine);
    shareRival.textContent = pct(1 - mine);
  }

  function say(html, kind) {
    verdict.innerHTML = html;
    verdict.className = 'verdict' + (kind ? ' ' + kind : '');
  }

  function play() {
    var you = youPos();
    settled = true;
    tries += 1;
    triesOut.textContent = tries;
    render();

    var mine = share(you, bestResponse(you));

    if (you === 0.5) {
      say(
        '<strong>Empate: 50% y 50%.</strong> Tu rival se ha puesto a tu lado y ' +
        'no ha podido hacer nada mejor: mires donde mires, no hay un lado ancho ' +
        'que robarte. Es el único sitio de la playa donde no pierdes — y por eso ' +
        'los dos acabáis aquí. Mira el precio que pagan los bañistas de los ' +
        'extremos: media playa andando.',
        'ok'
      );
      return;
    }

    var wide = you < 0.5 ? 'derecha' : 'izquierda';
    var msg =
      '<strong>Pierdes: ' + pct(mine) + ' contra ' + pct(1 - mine) + '.</strong> ' +
      'Tu rival se ha plantado pegado a ti por la ' + wide + ', que es donde ' +
      'queda más playa, y se ha quedado con todo ese lado.';
    if (tries >= 3) {
      msg += ' <em>Pista: ¿hay algún punto donde no le dejes un lado más ancho ' +
        'que el otro?</em>';
    }
    say(msg, 'bad');
  }

  function reset() {
    settled = false;
    render();
    say(
      'Coloca tu puesto donde quieras. Tu rival elegirá <em>después</em>, y lo ' +
      'hará de la mejor forma posible para él.'
    );
  }

  // Moving the cart after the rival has answered starts a fresh round.
  posInput.addEventListener('input', function () {
    if (settled) reset();
    else render();
  });
  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  render();
})();
