export function renderOverlayPage(options = {}) {
  const query = options.query || {};

  const fontSize = Number(query.fontSize ?? 64);
  const color = String(query.color ?? "#000000");
  const bg = query.transparent
    ? "transparent"
    : String(query.bg ?? "rgba(0,0,0,0)");
  const fontFamily = String(
    query.font ?? "Inter,system-ui,Arial,sans-serif"
  );
  const showLabel = String(query.label ?? "0") !== "0";
  const align = String(query.align ?? "center"); // left|center|right
  const weight = Number(query.weight ?? 700);
  const key = query.key ? String(query.key) : "";
  const qs = key ? `?key=${encodeURIComponent(key)}` : "";
  const title = String(query.title ?? "Stream Countdown");
  const shadow = String(query.shadow ?? "0") !== "0";
  const shadowColor = String(query.shadowColor ?? "rgba(0,0,0,0.7)");
  const shadowBlur = Number(query.shadowBlur ?? 8);
  const stroke = Number(query.stroke ?? 0);
  const strokeColor = String(query.strokeColor ?? "#000000");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>Timer Overlay</title>
    <style>
      html, body { height: 100%; }
      body { margin: 0; background: ${bg}; color: ${color}; font-family: ${fontFamily}; }
      .wrap { display: flex; align-items: center; justify-content: ${
        align === "left"
          ? "flex-start"
          : align === "right"
          ? "flex-end"
          : "center"
      }; height: 100%; padding: 0 8px; }
      .timer { font-variant-numeric: tabular-nums; letter-spacing: 1px; }
      .label { font-size: 14px; opacity: 0.75; margin-bottom: 4px; text-align: ${align}; }
      .hype { font-size: 12px; opacity: 0.9; margin-top: 4px; }
      .paused { font-size: 12px; opacity: 0.9; margin-top: 4px; }
      .cap  { font-size: 12px; opacity: 0.9; margin-top: 4px; }
      .cap.custom { font-size: 22px; font-weight: 700; opacity: 1; margin-top: 8px; }
      @keyframes flash {
        0% { opacity: 1; }
        50% { opacity: 0.3; }
        100% { opacity: 1; }
      }
      .flash { animation: flash 1s infinite; }
      @keyframes addPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.06); }
        100% { transform: scale(1); }
      }
      @keyframes addShake {
        0%,100% { transform: translateX(0); }
        25% { transform: translateX(-4px); }
        75% { transform: translateX(4px); }
      }
      @keyframes addBounce {
        0%,100% { transform: translateY(0); }
        25% { transform: translateY(-6px); }
        75% { transform: translateY(0); }
      }
      .add-pulse { animation: addPulse 0.4s ease-out; }
      .add-shake { animation: addShake 0.4s ease-out; }
      .add-bounce { animation: addBounce 0.4s ease-out; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div>
        <div id="label" class="label" style="display:none"></div>
        <div id="clock" class="timer" style="font-size:${fontSize}px; font-weight:${weight}; text-align:${align};${
    shadow
      ? ` text-shadow: 0 0 ${shadowBlur}px ${shadowColor}, 0 2px 2px ${shadowColor};`
      : ""
  }${
    stroke > 0
      ? ` -webkit-text-stroke: ${stroke}px ${strokeColor}; text-stroke: ${stroke}px ${strokeColor};`
      : ""
  }">--:--</div>
        <div id="hype" class="hype" style="display:none"></div>
        <div id="paused" class="paused" style="display:none">⏸ Paused</div>
        <div id="cap" class="cap" style="display:none">⏱ Stream has reached maximum length</div>
      </div>
    </div>
    <script>
      (function(){
        let remaining = 0;
        let lastRemaining = null;
        let hype = false;
        let tickTimer = null;
        let paused = false;
        let styleThresholds = {
          warnEnabled: true,
          warnUnderSeconds: 300,
          warnColor: '#FFA500',
          dangerEnabled: true,
          dangerUnderSeconds: 60,
          dangerColor: '#FF4D4D',
          flashEnabled: true,
          flashUnderSeconds: 0
        };
        let timeFormat = 'mm:ss';
        let cap = false;
        let capMessage = null;
        let capStyle = null;
        let addEffectEnabled = true;
        let addEffectMode = 'pulse';
        let hypeLabelEnabled = true;
        let hypeLabel = '🔥 Hype Train active';

        function render() {
          const el = document.getElementById('clock');
          var txt = '--:--';
          var r = Math.max(0, remaining|0);
          var d = Math.floor(r/86400), h = Math.floor((r%86400)/3600), m = Math.floor((r%3600)/60), s = r%60;
          if (timeFormat === 'dd:hh:mm:ss') {
            txt = String(d).padStart(2,'0') + ':' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
          } else if (timeFormat === 'hh:mm:ss') {
            var totalH = d * 24 + h;
            txt = String(totalH).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
          } else if (timeFormat === 'auto') {
            if (d > 0) {
              txt = String(d).padStart(2,'0') + ':' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
            } else if (h > 0) {
              txt = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
            } else {
              txt = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
            }
          } else {
            txt = String((Math.floor(r/60))).padStart(2,'0') + ':' + String(r%60).padStart(2,'0');
          }
          el.textContent = txt;
          const hypeEl = document.getElementById('hype');
          if (hypeEl) {
            hypeEl.style.display = hype && hypeLabelEnabled ? 'block' : 'none';
          }
          document.getElementById('paused').style.display = paused ? 'block' : 'none';
          var capEl = document.getElementById('cap');
          capEl.style.display = cap ? 'block' : 'none';
          if (cap && capMessage) {
            capEl.textContent = capMessage;
            capEl.className = 'cap custom';
            var clockFs = parseInt(document.getElementById('clock').style.fontSize, 10) || 48;
            var sz = capStyle && capStyle.size || 'larger';
            if (sz === 'larger') capEl.style.fontSize = Math.round(clockFs * 0.5) + 'px';
            else if (sz === 'smaller') capEl.style.fontSize = Math.round(clockFs * 0.25) + 'px';
            else capEl.style.fontSize = Math.round(clockFs * 0.35) + 'px';
            capEl.style.color = (capStyle && capStyle.color) || 'inherit';
            var pos = capStyle && capStyle.position || 'below';
            var wrap = capEl.parentNode;
            if (pos === 'above') { wrap.insertBefore(capEl, document.getElementById('label') || wrap.firstChild); }
            else { wrap.appendChild(capEl); }
          } else if (cap) {
            capEl.textContent = '\u23F1 Stream has reached maximum length';
            capEl.className = 'cap';
            capEl.style.fontSize = '';
            capEl.style.color = '';
          }

          // Apply threshold color/flash
          var color = el.style.color;
          var w = Number(styleThresholds.warnUnderSeconds||0);
          var d = Number(styleThresholds.dangerUnderSeconds||0);
          if (styleThresholds.dangerEnabled && d > 0 && remaining <= d) {
            color = styleThresholds.dangerColor || color;
          } else if (styleThresholds.warnEnabled && w > 0 && remaining <= w) {
            color = styleThresholds.warnColor || color;
          }
          el.style.color = color;
          var f = Number(styleThresholds.flashUnderSeconds||0);
          if (styleThresholds.flashEnabled && f > 0 && remaining <= f) {
            el.classList.add('flash');
          } else {
            el.classList.remove('flash');
          }
        }

        function triggerAddEffect() {
          if (!addEffectEnabled) return;
          const el = document.getElementById('clock');
          if (!el) return;
          el.classList.remove('add-pulse','add-shake','add-bounce');
          let cls = null;
          if (addEffectMode === 'shake') cls = 'add-shake';
          else if (addEffectMode === 'bounce') cls = 'add-bounce';
          else if (addEffectMode === 'none') return;
          else cls = 'add-pulse';
          void el.offsetWidth;
          el.classList.add(cls);
        }

        function startLocalTick() {
          if (tickTimer) clearInterval(tickTimer);
          tickTimer = setInterval(function(){
            if (!paused && remaining > 0) { remaining -= 1; render(); }
          }, 1000);
        }

        function applyStyle(s) {
          if (!s) return;
          try {
            const body = document.body;
            body.style.background = (s.transparent ? 'transparent' : (s.bg || 'transparent'));
            const clock = document.getElementById('clock');
            clock.style.fontSize = (s.fontSize || 64) + 'px';
            clock.style.color = s.color || '#FFFFFF';
            clock.style.fontFamily = s.font || 'Inter,system-ui,Arial,sans-serif';
            clock.style.fontWeight = String(s.weight || 700);
            clock.style.textAlign = s.align || 'center';
            if (s.shadow) {
              const blur = Number(s.shadowBlur || 8);
              const col = s.shadowColor || 'rgba(0,0,0,0.7)';
              clock.style.textShadow = '0 0 ' + blur + 'px ' + col + ', 0 2px 2px ' + col;
            } else {
              clock.style.textShadow = '';
            }
            if (Number(s.stroke || 0) > 0) {
              const w = Number(s.stroke);
              const sc = s.strokeColor || '#000000';
              clock.style.webkitTextStroke = w + 'px ' + sc;
              clock.style.textStroke = w + 'px ' + sc;
            } else {
              clock.style.webkitTextStroke = '';
              clock.style.textStroke = '';
            }
            const label = document.getElementById('label');
            if (label) {
              label.textContent = s.title || 'Stream Countdown';
              label.style.display = s.label ? 'block' : 'none';
              label.style.color = s.color || '#FFFFFF';
              label.style.textAlign = s.align || 'center';
            }
            const wrap = document.querySelector('.wrap');
            wrap.style.justifyContent = s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center';

            // thresholds
            styleThresholds.warnEnabled = (typeof s.warnEnabled === 'boolean') ? s.warnEnabled : true;
            styleThresholds.warnUnderSeconds = Number(s.warnUnderSeconds||0);
            styleThresholds.warnColor = s.warnColor || '#FFA500';
            styleThresholds.dangerEnabled = (typeof s.dangerEnabled === 'boolean') ? s.dangerEnabled : true;
            styleThresholds.dangerUnderSeconds = Number(s.dangerUnderSeconds||0);
            styleThresholds.dangerColor = s.dangerColor || '#FF4D4D';
            styleThresholds.flashEnabled = (typeof s.flashEnabled === 'boolean') ? s.flashEnabled : true;
            styleThresholds.flashUnderSeconds = Number(s.flashUnderSeconds||0);
            timeFormat = ['hh:mm:ss','dd:hh:mm:ss','auto'].includes(s.timeFormat) ? s.timeFormat : 'mm:ss';
            if (typeof s.addEffectEnabled === 'boolean') {
              addEffectEnabled = s.addEffectEnabled;
            } else {
              addEffectEnabled = true;
            }
            addEffectMode = s.addEffectMode || 'pulse';
            hypeLabelEnabled = (typeof s.hypeLabelEnabled === 'boolean') ? s.hypeLabelEnabled : true;
            hypeLabel = s.hypeLabel || '🔥 Hype Train active';
            const hypeEl = document.getElementById('hype');
            if (hypeEl) hypeEl.textContent = hypeLabel;
            render();
          } catch (e) {}
        }

        fetch('/api/timer/state${qs}').then(r => r.json()).then(s => {
          remaining = Number(s.remaining || 0);
          lastRemaining = remaining;
          hype = Boolean(s.hype);
          paused = Boolean(s.paused);
          cap = Boolean(s.capReached);
          render();
          startLocalTick();
        }).catch(function(){});

        (function(){
          var u = '/api/overlay/style${qs}';
          u += (u.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
          fetch(u, { cache: 'no-store' }).then(function(r){ return r.json(); }).then(applyStyle).catch(function(){});
        })();
        setInterval(function(){
          var u = '/api/overlay/style${qs}';
          u += (u.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
          fetch(u, { cache: 'no-store' }).then(function(r){ return r.json(); }).then(applyStyle).catch(function(){});
        }, 5000);

          (function connectSSE() {
            var retryDelay = 4000;
            try {
              const es = new EventSource('/api/overlay/stream${qs}');
              es.addEventListener('open', function() { retryDelay = 4000; });
              es.addEventListener('timer_tick', function(ev){
                try {
                  const data = JSON.parse(ev.data);
                  const prev = typeof remaining === 'number' ? remaining : null;
                  if (typeof data.remaining === 'number') { remaining = data.remaining; }
                  if (typeof data.hype === 'boolean') { hype = data.hype; }
                  if (typeof data.paused === 'boolean') { paused = data.paused; }
                  if (typeof data.capReached === 'boolean') { cap = data.capReached; }
                  if (typeof data.capMessage !== 'undefined') { capMessage = data.capMessage || null; }
                  if (typeof data.capStyle !== 'undefined') { capStyle = data.capStyle || null; }
                  if (prev !== null && data.remaining > prev) {
                    triggerAddEffect();
                  }
                  lastRemaining = data.remaining;
                  render();
                } catch (e) {}
              });
              es.addEventListener('style_update', function(ev){
                try { applyStyle(JSON.parse(ev.data)); } catch (e) {}
              });
              es.onerror = function() {
                es.close();
                setTimeout(connectSSE, retryDelay);
                retryDelay = Math.min(retryDelay * 2, 60000);
              };
            } catch (e) {}
          })();
      })();
    </script>
  </body>
</html>`;

  return html;
}
