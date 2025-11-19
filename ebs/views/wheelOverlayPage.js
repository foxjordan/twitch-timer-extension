export function renderWheelOverlayPage(options = {}) {
  const defaultOptions = [
    { label: "Heads", color: "#9146FF" },
    { label: "Tails", color: "#F97316" },
    { label: "Chat Pick", color: "#3B82F6" },
    { label: "Streamer Pick", color: "#10B981" },
  ];

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wheel Overlay</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #0e0e10; color: #f8fafc; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 20px; }
      .frame { width: min(420px, 100%); display:flex; flex-direction:column; gap: 16px; align-items:center; }
      canvas { width: min(360px, 80vw); height: min(360px, 80vw); background: #111827; border-radius: 50%; border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 0 30px rgba(0,0,0,0.45); }
      button { background: #9146FF; color: #fff; border: 0; border-radius: 999px; padding: 10px 20px; font-size: 16px; font-weight:600; cursor: pointer; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      .result { font-size: 28px; font-weight: 700; text-align:center; min-height: 34px; }
      .status { font-size: 13px; color: rgba(248,250,252,0.75); text-align:center; }
      .pointer { width: 0; height: 0; border-left: 18px solid transparent; border-right: 18px solid transparent; border-bottom: 24px solid #f43f5e; margin-bottom: -12px; }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="pointer"></div>
      <canvas id="wheelCanvas" width="360" height="360"></canvas>
      <div class="result" id="wheelResult">Waiting for spin…</div>
      <div class="status" id="wheelStatus"></div>
    </div>
    <script>
      (function(){
        const defaultOptions = ${JSON.stringify(defaultOptions)};
        const qs = new URLSearchParams(window.location.search);
        const overlayKey = qs.get('key') || '';
        const canvas = document.getElementById('wheelCanvas');
        const resultEl = document.getElementById('wheelResult');
        const statusEl = document.getElementById('wheelStatus');
        const ctx = canvas ? canvas.getContext('2d') : null;
        const TWO_PI = Math.PI * 2;
        const POINTER_ANGLE = Math.PI * 1.5;
        let wheelOptions = defaultOptions.slice();
        let wheelSegments = [];
        let wheelRotation = 0;
        let spinning = false;

        function decodeOptions(value) {
          try {
            const binary = atob(value);
            const percent = Array.prototype.map
              .call(binary, (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('');
            return decodeURIComponent(percent);
          } catch (e) {
            return '';
          }
        }

        const newlineSplitRegex = new RegExp('\\r?\\n+');

        function parseLegacyOptions(text) {
          return String(text || '')
            .split(newlineSplitRegex)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, idx) => {
              const parts = line.split('|');
              const label = parts[0].trim() || 'Option ' + (idx + 1);
              const color = (parts[1] && parts[1].trim()) || defaultOptions[idx % defaultOptions.length].color;
              return { label, color };
            });
        }

        function sanitize(options) {
          return (Array.isArray(options) ? options : [])
            .map((opt, idx) => {
              const label = String(opt && opt.label ? opt.label : '').trim();
              const color = String(opt && opt.color ? opt.color : '').trim() || defaultOptions[idx % defaultOptions.length].color;
              return { label: label || 'Option ' + (idx + 1), color };
            })
            .filter((opt) => Boolean(opt.label));
        }

        const encoded = qs.get('options');
        const legacyText = qs.get('wheelOptions');
        if (encoded) {
          const decoded = decodeOptions(encoded);
          if (decoded) {
            try {
              const parsed = JSON.parse(decoded);
              const sanitized = sanitize(parsed);
              if (sanitized.length) wheelOptions = sanitized;
            } catch (e) {
              const legacy = parseLegacyOptions(decoded);
              if (legacy.length) wheelOptions = legacy;
            }
          }
        } else if (legacyText) {
          const legacy = parseLegacyOptions(legacyText);
          if (legacy.length) wheelOptions = legacy;
        }

        function refreshSegments() {
          wheelSegments = wheelOptions.length
            ? wheelOptions
            : defaultOptions;
          if (!wheelSegments.length) {
            wheelSegments = defaultOptions;
          }
          drawWheel(wheelRotation);
        }

        function formatDurationSeconds(ms) {
          const seconds = ms / 1000;
          return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
        }

        function drawWheel(angle) {
          if (!ctx || !canvas) return;
          const size = canvas.width;
          const radius = size / 2 - 4;
          ctx.clearRect(0, 0, size, size);
          ctx.save();
          ctx.translate(size / 2, size / 2);
          ctx.rotate(angle);
          const slice = TWO_PI / wheelSegments.length;
          wheelSegments.forEach((segment, idx) => {
            const start = idx * slice;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, start, start + slice, false);
            ctx.closePath();
            ctx.fillStyle = segment.color || defaultOptions[idx % defaultOptions.length].color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.stroke();
            ctx.save();
            ctx.rotate(start + slice / 2);
            ctx.fillStyle = '#fff';
            ctx.font = '16px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(segment.label, radius - 12, 5);
            ctx.restore();
          });
          ctx.restore();
        }

        function announceWinner() {
          if (!wheelSegments.length) {
            resultEl.textContent = '—';
            return;
          }
          const slice = TWO_PI / wheelSegments.length;
          const rotation = ((wheelRotation % TWO_PI) + TWO_PI) % TWO_PI;
          const pointer = (POINTER_ANGLE + TWO_PI) % TWO_PI;
          const relative = (pointer - rotation + TWO_PI) % TWO_PI;
          const index = Math.floor(relative / slice) % wheelSegments.length;
          const winner = wheelSegments[index];
          resultEl.textContent = winner ? winner.label : '—';
        }

        refreshSegments();
        announceWinner();

        if (!overlayKey) {
          if (statusEl) statusEl.textContent = 'Missing overlay key.';
          return;
        }

        function handleSpinPayload(payload) {
          if (!payload) return;
          if (Array.isArray(payload.options) && payload.options.length) {
            const sanitized = sanitize(payload.options);
            if (sanitized.length) {
              wheelOptions = sanitized;
              refreshSegments();
            }
          }
          const winnerLabel = payload.winnerLabel || '';
          const winnerIndex = Number(payload.winnerIndex || 0);
          const lapCount = Number(Math.max(2, Number(payload.lapCount || 6)));
          const targetNormalized = Number(payload.targetNormalized);
          const durationMs = Number(payload.durationMs);
          const durationSeconds = Number(payload.durationSeconds);
          const slice = TWO_PI / wheelSegments.length;
          const currentNormalized = ((wheelRotation % TWO_PI) + TWO_PI) % TWO_PI;
          const normalizedTarget = Number.isFinite(targetNormalized)
            ? ((targetNormalized % TWO_PI) + TWO_PI) % TWO_PI
            : ((POINTER_ANGLE - (winnerIndex * slice + slice / 2)) % TWO_PI + TWO_PI) % TWO_PI;
          let baseDelta = normalizedTarget - currentNormalized;
          if (baseDelta < 0) baseDelta += TWO_PI;
          const delta = lapCount * TWO_PI + baseDelta;
          const finalAngle = wheelRotation + delta;
          let duration = Number.isFinite(durationMs) ? durationMs : NaN;
          if (!Number.isFinite(duration) && Number.isFinite(durationSeconds)) {
            duration = durationSeconds * 1000;
          }
          if (!Number.isFinite(duration)) {
            duration = Math.max(1000, lapCount * 800);
          }
          duration = Math.max(1000, Math.min(15000, duration));
          const started = animateWheelTo(finalAngle, duration, () => {
            resultEl.textContent = winnerLabel || wheelSegments[winnerIndex]?.label || '—';
            if (statusEl) statusEl.textContent = '';
          });
          if (started && statusEl) {
            statusEl.textContent = 'Spinning… (' + formatDurationSeconds(duration) + 's)';
          }
        }

        function animateWheelTo(finalAngle, durationMs, onDone) {
          if (spinning || !ctx) return false;
          const start = wheelRotation;
          const delta = finalAngle - start;
          const duration = Math.max(1000, Number(durationMs || 3200));
          spinning = true;
          const startAt = performance.now();
          function step(now) {
            const progress = Math.min(1, (now - startAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + delta * eased;
            drawWheel(current);
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              wheelRotation = current % TWO_PI;
              spinning = false;
              if (typeof onDone === 'function') onDone();
            }
          }
          requestAnimationFrame(step);
          return true;
        }

        const streamUrl = '/api/overlay/stream?key=' + encodeURIComponent(overlayKey);
        const source = new EventSource(streamUrl);
        source.addEventListener('wheel_spin', (event) => {
          if (!event || !event.data) return;
          try {
            const payload = JSON.parse(event.data);
            handleSpinPayload(payload);
          } catch (e) {}
        });

        source.addEventListener('error', () => {
          if (statusEl) statusEl.textContent = 'Disconnected from spinner stream...';
        });
        source.addEventListener('open', () => {
          if (statusEl) statusEl.textContent = '';
        });
      })();
    </script>
  </body>
</html>`;
}
