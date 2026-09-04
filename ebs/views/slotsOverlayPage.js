// Self-contained Slot Machine browser-source overlay. Mirrors plinkoOverlayPage.js:
// server-rendered HTML, inline CSS + one IIFE, no per-broadcaster data baked in.
// Idle look comes from an optional base64 `config` query param and every
// `slots_board` update; each `slots_spin` payload carries the `reels` array the
// server picked, replayed verbatim so the overlay lands on exactly those symbols.
export function renderSlotsOverlayPage() {
  const fallbackConfig = {
    baseSeconds: 30,
    symbols: [
      { name: '', url: '', source: '' },
      { name: '', url: '', source: '' },
      { name: '', url: '', source: '' },
    ],
    style: {
      panel: true,
      panelColor: '#0f0f12',
      panelOpacity: 0.82,
      reelColor: '#17171b',
      textColor: '#f8fafc',
      showStatus: true,
      reelSound: true,
      reelSoundVolume: 0.35,
      winSound: true,
      winSoundVolume: 0.5,
    },
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Slots Overlay</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: transparent; color: #f8fafc; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display:flex; align-items:center; justify-content:center; padding: 16px; overflow: hidden; }
      .frame { position: relative; width: 540px; max-width: 96vw; }
      .qhead { position:absolute; left:0; right:0; top:-46px; text-align:center; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
      .qhead .now { font-size:15px; font-weight:700; }
      .qhead .next { font-size:13px; opacity:0.7; }
      .panel { border-radius: 20px; padding: 20px; box-shadow: 0 12px 30px rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.06); }
      .stage { display:flex; gap: 14px; justify-content:center; }
      .reel { position:relative; width: 150px; height: 150px; border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.06), inset 0 10px 20px rgba(0,0,0,0.5), inset 0 -10px 20px rgba(0,0,0,0.5); }
      .strip { position:absolute; left:0; top:0; width:100%; will-change: transform; }
      .cell { width:150px; height:150px; display:flex; align-items:center; justify-content:center; }
      .cell img { width: 104px; height: 104px; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
      .cell .blank { width: 84px; height: 84px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 2px dashed rgba(255,255,255,0.12); }
      .reel.win { box-shadow: inset 0 0 0 3px #4ade80, 0 0 22px rgba(74,222,128,0.55); }
      .status { text-align:center; font-size:12px; opacity:0.72; margin-top: 12px; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
      .floater { position:absolute; left:0; right:0; top: 40%; text-align:center; font-size: 30px; font-weight: 800; pointer-events:none; text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="qhead" id="qhead" hidden><div class="now" id="qnow"></div><div class="next" id="qnext"></div></div>
      <div class="panel" id="panel">
        <div class="stage" id="stage">
          <div class="reel" id="reel0"><div class="strip" id="strip0"></div></div>
          <div class="reel" id="reel1"><div class="strip" id="strip1"></div></div>
          <div class="reel" id="reel2"><div class="strip" id="strip2"></div></div>
        </div>
        <div class="status" id="status">Waiting for a spin&hellip;</div>
      </div>
      <div class="floater" id="floater" hidden></div>
    </div>
    <script>
      (function () {
        var FALLBACK = ${JSON.stringify(fallbackConfig)};
        var qs = new URLSearchParams(window.location.search);
        var overlayKey = qs.get('key') || '';
        var boardId = qs.get('boardId') || '';

        var CH = 150;              // cell height (matches .cell / .reel)
        var REPEAT = 4;            // symbol sets rendered per strip (infinite-scroll buffer)
        var CLUNK_MS = 260;        // reel settle after it lands, before the result is revealed
        var SPIN_SETS = [11, 14, 17]; // full sets each reel travels before landing — L stops first

        var panelEl = document.getElementById('panel');
        var stageEl = document.getElementById('stage');
        var statusEl = document.getElementById('status');
        var floaterEl = document.getElementById('floater');
        var qheadEl = document.getElementById('qhead');
        var qnowEl = document.getElementById('qnow');
        var qnextEl = document.getElementById('qnext');
        var reelEls = [document.getElementById('reel0'), document.getElementById('reel1'), document.getElementById('reel2')];
        var stripEls = [document.getElementById('strip0'), document.getElementById('strip1'), document.getElementById('strip2')];

        var board = decodeConfig(qs.get('config')) || FALLBACK;
        var animating = false;
        var restingTimer = null;
        var queueInfo = null;

        // --- audio ---------------------------------------------------------
        var reelPool = [];
        var reelIdx = 0;
        try {
          for (var i = 0; i < 3; i++) { var a = new Audio('/assets/plink_sound.mp3'); a.preload = 'auto'; reelPool.push(a); }
        } catch (e) { reelPool = []; }
        function playReelStop() {
          var s = style();
          if (!s.reelSound || !reelPool.length) return;
          var el = reelPool[reelIdx];
          reelIdx = (reelIdx + 1) % reelPool.length;
          try { el.volume = clamp(s.reelSoundVolume, 0, 1); el.currentTime = 0; var p = el.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        }
        var winAudio = null;
        try { winAudio = new Audio('/assets/plinko_win_sound.wav'); winAudio.preload = 'auto'; } catch (e) {}
        function playWin() {
          var s = style();
          if (!s.winSound || !winAudio) return;
          try { winAudio.volume = clamp(s.winSoundVolume, 0, 1); winAudio.currentTime = 0; var p = winAudio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        }

        function style() {
          var s = board.style || {};
          var d = FALLBACK.style;
          return {
            panel: typeof s.panel === 'boolean' ? s.panel : d.panel,
            panelColor: s.panelColor || d.panelColor,
            panelOpacity: typeof s.panelOpacity === 'number' ? s.panelOpacity : d.panelOpacity,
            reelColor: s.reelColor || d.reelColor,
            textColor: s.textColor || d.textColor,
            showStatus: typeof s.showStatus === 'boolean' ? s.showStatus : d.showStatus,
            reelSound: typeof s.reelSound === 'boolean' ? s.reelSound : d.reelSound,
            reelSoundVolume: typeof s.reelSoundVolume === 'number' ? s.reelSoundVolume : d.reelSoundVolume,
            winSound: typeof s.winSound === 'boolean' ? s.winSound : d.winSound,
            winSoundVolume: typeof s.winSoundVolume === 'number' ? s.winSoundVolume : d.winSoundVolume,
          };
        }
        function symbols() {
          var arr = Array.isArray(board.symbols) && board.symbols.length ? board.symbols : FALLBACK.symbols;
          return arr;
        }
        // Built with DOM nodes only (no innerHTML) — sym.url is server-sanitized
        // to an https Twitch/7TV host, and setting .src never parses markup.
        function makeCell(sym) {
          var d = document.createElement('div');
          d.className = 'cell';
          if (sym && sym.url) {
            var img = document.createElement('img');
            img.src = sym.url;
            img.alt = sym.name || '';
            d.appendChild(img);
          } else {
            var blank = document.createElement('span');
            blank.className = 'blank';
            d.appendChild(blank);
          }
          return d;
        }
        function clearStrip(strip) {
          while (strip.firstChild) strip.removeChild(strip.firstChild);
        }

        function applyStyle() {
          var s = style();
          panelEl.style.background = s.panel ? hexToRgba(s.panelColor, s.panelOpacity) : 'transparent';
          panelEl.style.boxShadow = s.panel ? '' : 'none';
          panelEl.style.border = s.panel ? '' : 'none';
          statusEl.style.color = s.textColor;
          statusEl.hidden = !s.showStatus;
          qheadEl.style.color = s.textColor;
          floaterEl.style.color = s.textColor;
          for (var i = 0; i < 3; i++) reelEls[i].style.background = s.reelColor;
        }

        function renderIdle() {
          var syms = symbols();
          for (var i = 0; i < 3; i++) {
            var strip = stripEls[i];
            strip.style.transition = 'none';
            strip.style.transform = 'translateY(0px)';
            clearStrip(strip);
            strip.appendChild(makeCell(syms[i % syms.length]));
            reelEls[i].classList.remove('win');
          }
          if (!animating && style().showStatus) statusEl.textContent = 'Waiting for a spin…';
        }

        function applyBoard(p) {
          if (!p) return;
          if (Array.isArray(p.symbols) && p.symbols.length) board.symbols = p.symbols;
          if (p.style && typeof p.style === 'object') board.style = p.style;
          if (typeof p.baseSeconds === 'number') board.baseSeconds = p.baseSeconds;
          applyStyle();
          if (!animating) renderIdle();
        }

        // --- spin --------------------------------------------------------------
        function handleSpin(p) {
          if (!p || animating) return;
          if (restingTimer) { clearTimeout(restingTimer); restingTimer = null; }
          floaterEl.hidden = true;
          // adopt symbols/style from the payload so the reels show the right art
          if (Array.isArray(p.symbols) && p.symbols.length) board.symbols = p.symbols;
          if (p.style && typeof p.style === 'object') board.style = p.style;
          applyStyle();

          var syms = symbols();
          var S = syms.length;
          var reels = Array.isArray(p.reels) && p.reels.length === 3 ? p.reels : [0, 0, 0];
          animating = true;
          if (style().showStatus) statusEl.textContent = p.test ? 'Test spin…' : 'Spinning…';
          for (var r = 0; r < 3; r++) reelEls[r].classList.remove('win');

          var SET_H = S * CH;
          // Reels stop L->R; the last stop lands CLUNK_MS before the payload's
          // durationMs, which is also when the server credits the timer — so the
          // result reveal, the clunk and the +time all land together.
          var lastStop = Math.max(900, (Number(p.durationMs) || 2700) - CLUNK_MS);
          var STOP_MS = [lastStop - 900, lastStop - 450, lastStop];

          // Per reel: an infinite-scroll strip (REPEAT sets) driven by rAF —
          // scrolls fast and near-linear (symbols blur past), then decelerates
          // straight onto the target (no fly-past). Wrap math keeps the
          // transform inside the rendered cells.
          var lane = [];
          for (var li = 0; li < 3; li++) {
            var target = clamp(Number(reels[li]) || 0, 0, S - 1);
            var strip = stripEls[li];
            strip.style.transition = 'none';
            clearStrip(strip);
            for (var c = 0; c < REPEAT * S; c++) strip.appendChild(makeCell(syms[c % S]));
            strip.style.transform = 'translateY(' + (-SET_H) + 'px)';
            lane.push({
              strip: strip,
              stopMs: STOP_MS[li],
              finalTravel: SPIN_SETS[li] * SET_H + target * CH,
              target: target,
              done: false,
            });
          }

          // fast near-linear blur -> firm ease-out, monotonic, lands exactly.
          function easeSlot(t) {
            if (t >= 1) return 1;
            if (t < 0.55) return 0.78 * (t / 0.55);
            var p1 = (t - 0.55) / 0.45;
            return 0.78 + (1 - Math.pow(1 - p1, 3.4)) * 0.22;
          }

          var t0 = performance.now();
          var stopped = 0;
          function frame(now) {
            var elapsed = now - t0;
            for (var i = 0; i < 3; i++) {
              var L = lane[i];
              if (L.done) continue;
              var t = clamp(elapsed / L.stopMs, 0, 1);
              var travel = easeSlot(t) * L.finalTravel;
              var wrapped = ((travel % SET_H) + SET_H) % SET_H;
              L.strip.style.transform = 'translateY(' + (-(wrapped + SET_H)) + 'px)';
              if (t >= 1) {
                L.done = true;
                var restY = -(L.target * CH + SET_H);
                L.strip.style.transform = 'translateY(' + restY + 'px)';
                playReelStop();
                // small mechanical clunk: a 6px nudge that springs back
                L.strip.style.transition = 'transform 90ms ease-out';
                L.strip.style.transform = 'translateY(' + (restY + 6) + 'px)';
                (function (strip, y) {
                  setTimeout(function () {
                    strip.style.transition = 'transform 130ms cubic-bezier(0.34,1.56,0.64,1)';
                    strip.style.transform = 'translateY(' + y + 'px)';
                    setTimeout(function () { strip.style.transition = 'none'; }, 140);
                  }, 90);
                })(L.strip, restY);
                stopped++;
                if (stopped === 3) setTimeout(function () { finishSpin(p); }, CLUNK_MS);
              }
            }
            if (stopped < 3) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        }

        function finishSpin(p) {
          animating = false;
          var matchKind = p.matchKind || 'none';
          var reels = Array.isArray(p.reels) ? p.reels : [];
          var winReels = [];
          if (matchKind === 'triple') winReels = [0, 1, 2];
          else if (matchKind === 'pair') {
            if (reels[0] === reels[1]) winReels = [0, 1];
            else if (reels[1] === reels[2]) winReels = [1, 2];
            else if (reels[0] === reels[2]) winReels = [0, 2];
          }
          for (var i = 0; i < winReels.length; i++) reelEls[winReels[i]].classList.add('win');

          if (matchKind !== 'none') playWin();

          var mult = Number(p.multiplier) || 1;
          if (p.test) {
            showFloater('TEST  x' + trimNum(mult), '#FCD34D');
            if (style().showStatus) statusEl.textContent = 'Test: ' + matchKind + '  x' + trimNum(mult);
          } else {
            var added = Number(p.secondsAdded) || 0;
            showFloater('+' + formatSeconds(added), '#4ade80');
            if (style().showStatus) statusEl.textContent = matchKind + '  x' + trimNum(mult) + '  (+' + formatSeconds(added) + ')';
          }

          setTimeout(function () {
            if (!animating && style().showStatus) statusEl.textContent = 'Waiting for a spin…';
          }, 6000);

          if (restingTimer) clearTimeout(restingTimer);
          restingTimer = setTimeout(function () {
            restingTimer = null;
            if (!animating) { fadeOutFloater(); renderIdle(); }
          }, 2500);
        }

        function showFloater(text, color) {
          floaterEl.textContent = text;
          floaterEl.style.color = color;
          floaterEl.style.transition = 'none';
          floaterEl.style.opacity = '1';
          floaterEl.style.transform = 'translateY(0)';
          floaterEl.hidden = false;
          /* eslint-disable no-unused-expressions */
          floaterEl.offsetHeight;
          floaterEl.style.transition = 'opacity 1500ms ease, transform 1500ms ease';
          floaterEl.style.opacity = '0';
          floaterEl.style.transform = 'translateY(-46px)';
        }
        function fadeOutFloater() {
          floaterEl.style.transition = 'opacity 400ms ease';
          floaterEl.style.opacity = '0';
          setTimeout(function () { floaterEl.hidden = true; }, 420);
        }

        // --- queue header ----------------------------------------------------
        function renderQueue() {
          var s = style();
          var active = queueInfo && (queueInfo.nowPlaying || queueInfo.waitingCount);
          if (!s.showStatus || !active) { qheadEl.hidden = true; return; }
          qheadEl.hidden = false;
          qnowEl.textContent = queueInfo.nowPlaying ? '▶ ' + (queueInfo.nowPlaying.viewerName || 'Someone') : '';
          var waiting = queueInfo.waiting || [];
          if (waiting.length) {
            var extra = Math.max(0, (Number(queueInfo.waitingCount) || waiting.length) - 1);
            qnextEl.textContent = 'next: ' + (waiting[0].viewerName || 'Someone') + (extra > 0 ? '  +' + extra + ' more' : '');
          } else {
            qnextEl.textContent = '';
          }
        }

        // --- helpers -------------------------------------------------------
        function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
        function trimNum(n) { return String(Math.round((Number(n) || 0) * 100) / 100); }
        function formatSeconds(total) {
          total = Math.round(total);
          var m = Math.floor(total / 60), s = total % 60;
          if (m <= 0) return s + 's';
          return m + 'm' + (s ? ' ' + s + 's' : '');
        }
        function hexToRgba(hex, a) {
          var h = String(hex || '#0f0f12').replace('#', '');
          if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
          var num = parseInt(h, 16);
          if (isNaN(num)) return 'rgba(15,15,18,' + a + ')';
          return 'rgba(' + ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255) + ',' + a + ')';
        }
        function decodeConfig(value) {
          if (!value) return null;
          try {
            var bin = atob(value);
            var pct = Array.prototype.map
              .call(bin, function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); })
              .join('');
            var obj = JSON.parse(decodeURIComponent(pct));
            if (obj && Array.isArray(obj.symbols) && obj.symbols.length) return obj;
          } catch (e) {}
          return null;
        }

        applyStyle();
        renderIdle();
        if (!overlayKey) { statusEl.hidden = false; statusEl.textContent = 'Missing overlay key.'; return; }

        (function connectSSE() {
          var retryDelay = 4000;
          var url = '/api/overlay/stream?key=' + encodeURIComponent(overlayKey);
          if (boardId) url += '&boardId=' + encodeURIComponent(boardId);
          var source = new EventSource(url);

          source.addEventListener('open', function () {
            retryDelay = 4000;
            if (!animating && style().showStatus) statusEl.textContent = 'Waiting for a spin…';
          });
          source.addEventListener('slots_spin', function (event) {
            if (!event || !event.data) return;
            try { handleSpin(JSON.parse(event.data)); } catch (e) {}
          });
          source.addEventListener('slots_board', function (event) {
            if (!event || !event.data) return;
            try { applyBoard(JSON.parse(event.data)); } catch (e) {}
          });
          source.addEventListener('slots_queue', function (event) {
            if (!event || !event.data) return;
            try { queueInfo = JSON.parse(event.data); renderQueue(); } catch (e) {}
          });
          source.addEventListener('error', function () {
            source.close();
            setTimeout(connectSSE, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 60000);
          });
        })();
      })();
    </script>
  </body>
</html>`;
}
