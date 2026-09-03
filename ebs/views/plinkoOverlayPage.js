// Self-contained Plinko browser-source overlay. Mirrors wheelOverlayPage.js:
// server-rendered HTML, inline CSS + one IIFE, no per-broadcaster data baked
// in. Board geometry comes from an optional base64 `config` query param for
// the idle state, and is refreshed from every `plinko_drop` SSE payload — the
// payload's `path` array is replayed verbatim so the token lands exactly on
// the bin the server picked.
export function renderPlinkoOverlayPage() {
  const fallbackConfig = {
    rows: 9,
    bins: [
      { multiplier: 4, color: '#F97316' },
      { multiplier: 2.25, color: '#EC4899' },
      { multiplier: 1.5, color: '#3B82F6' },
      { multiplier: 1.25, color: '#9146FF' },
      { multiplier: 1, color: '#9146FF' },
      { multiplier: 1, color: '#9146FF' },
      { multiplier: 1.25, color: '#9146FF' },
      { multiplier: 1.5, color: '#3B82F6' },
      { multiplier: 2.25, color: '#EC4899' },
      { multiplier: 4, color: '#F97316' },
    ],
    token: { name: '', url: '', source: '' },
    style: {
      panel: true,
      panelColor: '#0f0f12',
      panelOpacity: 0.82,
      pegs: true,
      pegColor: '#ffffff',
      textColor: '#f8fafc',
      showStatus: true,
      pegSound: true,
      pegSoundVolume: 0.35,
      winSound: true,
      winSoundVolume: 0.5,
    },
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plinko Overlay</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: transparent; color: #f8fafc; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display:flex; align-items:center; justify-content:center; padding: 16px; overflow: hidden; }
      .frame { position: relative; width: min(560px, 96vw); }
      canvas { width: 100%; height: auto; display: block; filter: drop-shadow(0 12px 30px rgba(0,0,0,0.45)); }
      .status { position:absolute; left:0; right:0; bottom:-24px; text-align:center; font-size:12px; color: rgba(248,250,252,0.7); text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
    </style>
  </head>
  <body>
    <div class="frame">
      <canvas id="board" width="560" height="680"></canvas>
      <div class="status" id="status">Waiting for drop…</div>
    </div>
    <script>
      (function () {
        var FALLBACK = ${JSON.stringify(fallbackConfig)};
        var qs = new URLSearchParams(window.location.search);
        var overlayKey = qs.get('key') || '';
        var boardId = qs.get('boardId') || '';
        var canvas = document.getElementById('board');
        var statusEl = document.getElementById('status');
        var ctx = canvas ? canvas.getContext('2d') : null;

        var W = canvas.width, H = canvas.height;
        var PAD_X = 42, TOP_Y = 64, BINS_H = 74;
        var binsTop = H - BINS_H - 16;

        var board = decodeConfig(qs.get('config')) || FALLBACK;
        var tokenImg = null;
        var animating = false;
        var resting = null; // { x, y, r } token left in a bin between drops
        var restingTimer = null; // clears the resting token a bit after the last drop
        var fading = false;
        var queueInfo = null; // { nowPlaying, waiting[], waitingCount } from plinko_queue

        function boardStyle() {
          var s = board.style || {};
          var d = FALLBACK.style;
          return {
            panel: typeof s.panel === 'boolean' ? s.panel : d.panel,
            panelColor: s.panelColor || d.panelColor,
            panelOpacity: typeof s.panelOpacity === 'number' ? s.panelOpacity : d.panelOpacity,
            pegs: typeof s.pegs === 'boolean' ? s.pegs : d.pegs,
            pegColor: s.pegColor || d.pegColor,
            textColor: s.textColor || d.textColor,
            showStatus: typeof s.showStatus === 'boolean' ? s.showStatus : d.showStatus,
            pegSound: typeof s.pegSound === 'boolean' ? s.pegSound : d.pegSound,
            pegSoundVolume: typeof s.pegSoundVolume === 'number' ? s.pegSoundVolume : d.pegSoundVolume,
            winSound: typeof s.winSound === 'boolean' ? s.winSound : d.winSound,
            winSoundVolume: typeof s.winSoundVolume === 'number' ? s.winSoundVolume : d.winSoundVolume,
          };
        }
        function applyStatusVisibility() {
          var s = boardStyle();
          statusEl.hidden = !s.showStatus;
          statusEl.style.color = s.textColor;
        }

        // Peg-hit click. A short pool of Audio elements cycled round-robin so
        // rapid bounces overlap instead of cutting each other off.
        var PLINK_SRC = '/assets/plink_sound.mp3';
        var plinkPool = [];
        var plinkIdx = 0;
        try {
          for (var pi = 0; pi < 6; pi++) {
            var pa = new Audio(PLINK_SRC);
            pa.preload = 'auto';
            plinkPool.push(pa);
          }
        } catch (e) { plinkPool = []; }
        function playPlink() {
          var s = boardStyle();
          if (!s.pegSound || !plinkPool.length) return;
          var a = plinkPool[plinkIdx];
          plinkIdx = (plinkIdx + 1) % plinkPool.length;
          try {
            a.volume = Math.max(0, Math.min(1, s.pegSoundVolume));
            a.currentTime = 0;
            var p = a.play();
            if (p && p.catch) p.catch(function () {});
          } catch (e) {}
        }

        // Payoff sting when the token settles into a bin — plays once, so a
        // single element is enough.
        var winAudio = null;
        try { winAudio = new Audio('/assets/plinko_win_sound.wav'); winAudio.preload = 'auto'; } catch (e) {}
        function playWin() {
          var s = boardStyle();
          if (!s.winSound || !winAudio) return;
          try {
            winAudio.volume = Math.max(0, Math.min(1, s.winSoundVolume));
            winAudio.currentTime = 0;
            var p = winAudio.play();
            if (p && p.catch) p.catch(function () {});
          } catch (e) {}
        }

        loadToken(board.token);
        applyStatusVisibility();
        drawIdle();

        if (!overlayKey) { statusEl.hidden = false; statusEl.textContent = 'Missing overlay key.'; return; }

        function decodeConfig(value) {
          if (!value) return null;
          try {
            var bin = atob(value);
            var pct = Array.prototype.map
              .call(bin, function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); })
              .join('');
            var obj = JSON.parse(decodeURIComponent(pct));
            if (obj && Array.isArray(obj.bins) && obj.bins.length) return obj;
          } catch (e) {}
          return null;
        }

        function loadToken(token) {
          tokenImg = null;
          if (!token || !token.url) return;
          var img = new Image();
          img.onload = function () { tokenImg = img; if (!animating) drawIdle(); };
          img.onerror = function () { tokenImg = null; };
          img.src = token.url;
        }

        function rows() { return Math.max(4, Number(board.rows) || FALLBACK.rows); }
        function binCount() { return rows() + 1; }
        function binW() { return (W - PAD_X * 2) / binCount(); }
        function xForPos(u) { return PAD_X + (u + 0.5) * binW(); }
        function rowGap() { return (binsTop - TOP_Y) / (rows() + 1); }
        function tokenR() { return Math.min(binW() * 0.42, rowGap() * 0.9, 26); }

        function drawBoard(highlightBin) {
          ctx.clearRect(0, 0, W, H);
          var n = rows();
          var s = boardStyle();

          // rounded backing panel (optional)
          if (s.panel) {
            roundRect(6, 6, W - 12, H - 12, 22);
            ctx.fillStyle = hexToRgba(s.panelColor, s.panelOpacity);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.stroke();
          }

          // header — whose token is dropping now / up next
          if (queueInfo && (queueInfo.nowPlaying || queueInfo.waitingCount)) {
            var nowName = queueInfo.nowPlaying ? queueInfo.nowPlaying.viewerName : '';
            var waitList = queueInfo.waiting || [];
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (nowName) {
              ctx.fillStyle = s.textColor;
              ctx.font = 'bold 15px Inter, system-ui, sans-serif';
              ctx.fillText('▶ ' + nowName, W / 2, 24);
            }
            if (waitList.length) {
              var extra = Math.max(0, (Number(queueInfo.waitingCount) || waitList.length) - 1);
              ctx.fillStyle = hexToRgba(s.textColor, 0.7);
              ctx.font = '13px Inter, system-ui, sans-serif';
              ctx.fillText('next: ' + waitList[0].viewerName + (extra > 0 ? '  +' + extra + ' more' : ''), W / 2, 46);
            }
          }

          // pegs — decorative triangular lattice (optional)
          if (s.pegs) {
          ctx.fillStyle = hexToRgba(s.pegColor, 0.55);
          for (var r = 0; r < n; r++) {
            var y = TOP_Y + (r + 1) * rowGap();
            var shift = r % 2 === 0 ? 0.5 : 0;
            for (var k = -1; k <= n + 1; k++) {
              var u = k + shift;
              if (u < -0.2 || u > n + 0.2) continue;
              ctx.beginPath();
              ctx.arc(xForPos(u), y, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          }

          // bins
          var bins = board.bins || FALLBACK.bins;
          for (var i = 0; i < binCount(); i++) {
            var b = bins[i] || bins[bins.length - 1] || { multiplier: 1, color: '#9146FF' };
            var bx = PAD_X + i * binW();
            var active = i === highlightBin;
            ctx.fillStyle = hexToRgba(b.color, active ? 0.85 : 0.22);
            ctx.fillRect(bx + 2, binsTop, binW() - 4, BINS_H);
            ctx.fillStyle = b.color;
            ctx.fillRect(bx + 2, binsTop, binW() - 4, 4);
            ctx.fillStyle = active ? s.textColor : hexToRgba(s.textColor, 0.9);
            ctx.font = (active ? 'bold ' : '') + Math.min(18, binW() * 0.5) + 'px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('x' + trimNum(b.multiplier), bx + binW() / 2, binsTop + BINS_H / 2 + 2);
          }
        }

        function drawToken(x, y) {
          var r = tokenR();
          if (tokenImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(tokenImg, x - r, y - r, r * 2, r * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#FCD34D';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.stroke();
          }
        }

        function drawIdle() {
          drawBoard(-1);
          if (resting) drawToken(resting.x, resting.y);
        }

        // Adopt the board look (rows / bins / token / style) from a drop payload
        // or a standalone plinko_board update, so a live source restyles without
        // a reload.
        function applyBoard(p) {
          if (!p) return;
          if (Array.isArray(p.bins) && p.bins.length) board.bins = p.bins;
          if (p.rows) board.rows = p.rows;
          if (p.style && typeof p.style === 'object') board.style = p.style;
          if (p.token) {
            var newUrl = p.token.url || '';
            if (newUrl !== ((board.token && board.token.url) || '')) {
              board.token = p.token;
              loadToken(p.token);
            } else {
              board.token = p.token;
            }
          }
          applyStatusVisibility();
        }

        function handleDrop(p) {
          if (!p || animating) return;
          if (restingTimer) { clearTimeout(restingTimer); restingTimer = null; }
          fading = false;
          applyBoard(p);

          var nRows = rows();
          var path = Array.isArray(p.path) ? p.path : [];
          var n = path.length || nRows;
          var start = clamp(Number(p.dropColumn) || 0, 0, nRows);
          var duration = clamp(Number(p.durationMs) || (1400 + n * 420), 1600, 14000);

          // Rebuild the exact position sequence the server walked. Walls clamp
          // to the real bin range [0, nRows], matching simulatePlinko.
          var stops = [start];
          var pos = start;
          for (var i = 0; i < n; i++) {
            pos += path[i] ? 0.5 : -0.5;
            if (pos < 0) pos = 0;
            if (pos > nRows) pos = nRows;
            stops.push(pos);
          }
          var landBin = typeof p.binIndex === 'number' ? p.binIndex : Math.round(pos);

          animating = true;
          resting = null;
          statusEl.textContent = p.test ? 'Test drop…' : 'Dropping…';

          var t0 = performance.now();
          var segMs = duration / (n + 1); // n bounces + 1 settle into the bin
          var vGap = (binsTop - TOP_Y) / (n + 1);
          var lastPlinkedSeg = -1;

          function frame(now) {
            var elapsed = now - t0;
            var seg = Math.min(n, Math.floor(elapsed / segMs));
            var f = clamp((elapsed - seg * segMs) / segMs, 0, 1);

            if (seg > lastPlinkedSeg && seg < n) {
              lastPlinkedSeg = seg;
              playPlink(); // one click per peg row the token bounces off
            }
            var eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;

            var fromU = stops[seg];
            var toU = stops[Math.min(seg + 1, stops.length - 1)];
            var u = fromU + (toU - fromU) * eased;

            var y = TOP_Y + (seg + f) * vGap;
            var hop = seg < n ? Math.sin(f * Math.PI) * Math.min(vGap, 46) * 0.5 : 0;

            drawBoard(elapsed >= duration - segMs ? landBin : -1);
            drawToken(xForPos(u), y - hop);

            if (elapsed < duration) {
              requestAnimationFrame(frame);
            } else {
              finishDrop(landBin, p);
            }
          }
          requestAnimationFrame(frame);
        }

        function finishDrop(landBin, p) {
          animating = false;
          playWin();
          var restX = xForPos(clamp(landBin, 0, rows()));
          var restY = binsTop + BINS_H / 2;
          resting = { x: restX, y: restY };
          drawBoard(landBin);
          drawToken(restX, restY);

          var bins = board.bins || FALLBACK.bins;
          var mult = bins[landBin] ? bins[landBin].multiplier : 1;
          if (p.test) {
            floatText('TEST  x' + trimNum(mult), restX, binsTop - 6, '#FCD34D');
            statusEl.textContent = 'Test landed on x' + trimNum(mult);
          } else {
            var added = Number(p.secondsAdded) || 0;
            var label = added > 0 ? '+' + formatSeconds(added) : 'x' + trimNum(mult);
            floatText(label, restX, binsTop - 6, '#4ade80');
            statusEl.textContent = 'Landed on x' + trimNum(mult) + (added > 0 ? '  (+' + formatSeconds(added) + ')' : '');
          }

          setTimeout(function () {
            if (animating) return;
            statusEl.textContent = 'Waiting for drop…';
          }, 6000);

          // If no further drop follows, retire the resting token after a beat.
          if (restingTimer) clearTimeout(restingTimer);
          restingTimer = setTimeout(function () {
            restingTimer = null;
            if (!animating) fadeResting();
          }, 2500);
        }

        function fadeResting() {
          if (!resting) { drawIdle(); return; }
          var from = { x: resting.x, y: resting.y };
          var start = performance.now();
          var dur = 500;
          fading = true;
          function step(now) {
            if (animating) { fading = false; return; }
            var f = clamp((now - start) / dur, 0, 1);
            drawBoard(-1);
            ctx.save();
            ctx.globalAlpha = 1 - f;
            drawToken(from.x, from.y);
            ctx.restore();
            if (f < 1) {
              requestAnimationFrame(step);
            } else {
              fading = false;
              resting = null;
              drawIdle();
            }
          }
          requestAnimationFrame(step);
        }

        function floatText(text, x, y, color) {
          var start = performance.now();
          var dur = 1600;
          function step(now) {
            if (animating) return; // a new drop took over
            var f = clamp((now - start) / dur, 0, 1);
            drawIdle();
            ctx.save();
            ctx.globalAlpha = 1 - f;
            ctx.fillStyle = color;
            ctx.font = 'bold 26px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(text, x, y - f * 42);
            ctx.restore();
            if (f < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }

        // --- helpers ---------------------------------------------------------
        function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
        function trimNum(n) {
          var x = Math.round((Number(n) || 0) * 100) / 100;
          return String(x);
        }
        function formatSeconds(total) {
          total = Math.round(total);
          var m = Math.floor(total / 60), s = total % 60;
          if (m <= 0) return s + 's';
          return m + 'm' + (s ? ' ' + s + 's' : '');
        }
        function roundRect(x, y, w, h, r) {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        }
        function hexToRgba(hex, a) {
          var h = String(hex || '#9146FF').replace('#', '');
          if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
          var num = parseInt(h, 16);
          if (isNaN(num)) return 'rgba(145,70,255,' + a + ')';
          return 'rgba(' + ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255) + ',' + a + ')';
        }

        (function connectSSE() {
          var retryDelay = 4000;
          var url = '/api/overlay/stream?key=' + encodeURIComponent(overlayKey);
          if (boardId) url += '&boardId=' + encodeURIComponent(boardId);
          var source = new EventSource(url);

          source.addEventListener('open', function () {
            retryDelay = 4000;
            if (!animating && !resting) statusEl.textContent = 'Waiting for drop…';
          });

          source.addEventListener('plinko_drop', function (event) {
            if (!event || !event.data) return;
            try { handleDrop(JSON.parse(event.data)); } catch (e) {}
          });

          source.addEventListener('plinko_board', function (event) {
            if (!event || !event.data) return;
            try {
              applyBoard(JSON.parse(event.data));
              if (!animating) drawIdle();
            } catch (e) {}
          });

          source.addEventListener('plinko_queue', function (event) {
            if (!event || !event.data) return;
            try {
              queueInfo = JSON.parse(event.data);
              if (!animating && !fading) drawIdle();
            } catch (e) {}
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
