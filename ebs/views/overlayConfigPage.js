export function renderOverlayConfigPage(options = {}) {
  const { base, adminName, userKey, settings, rulesSnapshot, initialQuery = {} } = options;

  const safeNum = (val, fallback = 0) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  };

  const devCharityUsd = 5;
  const devTest = {
    bitsSeconds: safeNum(rulesSnapshot?.bits?.add_seconds, 60),
    bitsPer: safeNum(rulesSnapshot?.bits?.per, 100),
    subSeconds: safeNum(rulesSnapshot?.sub?.['1000'], 300),
    resubSeconds: safeNum(rulesSnapshot?.resub?.base_seconds, 300),
    giftSeconds: safeNum(rulesSnapshot?.gift_sub?.per_sub_seconds, 300),
    charityUsd: devCharityUsd,
    charitySeconds: safeNum(rulesSnapshot?.charity?.per_usd, 60) * devCharityUsd,
  };

  const defSecs = Number(settings.defaultInitialSeconds || 0);
  const defH = Math.floor(defSecs / 3600);
  const defM = Math.floor((defSecs % 3600) / 60);
  const defS = defSecs % 60;
  const initial = {
    fontSize: Number(initialQuery.fontSize ?? 64),
    color: String(initialQuery.color ?? '#000000'),
    bg: String(initialQuery.bg ?? 'rgba(0,0,0,0)'),
    transparent: String(initialQuery.transparent ?? '1') !== '0',
    font: String(initialQuery.font ?? 'Inter,system-ui,Arial,sans-serif'),
    label: String(initialQuery.label ?? '0') !== '0',
    title: String(initialQuery.title ?? 'Stream Countdown'),
    align: String(initialQuery.align ?? 'center'),
    weight: Number(initialQuery.weight ?? 700),
    shadow: String(initialQuery.shadow ?? '0') !== '0',
    shadowColor: String(initialQuery.shadowColor ?? 'rgba(0,0,0,0.7)'),
    shadowBlur: Number(initialQuery.shadowBlur ?? 8),
    stroke: Number(initialQuery.stroke ?? 0),
    strokeColor: String(initialQuery.strokeColor ?? '#000000'),
    key: String(initialQuery.key ?? ''),
  };

  const html = `\`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Timer Overlay Configurator</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: #0e0e10; color: #efeff1; }
      header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #1b1b1f; border-bottom: 1px solid #303038; }
      header .left { font-weight: 600; }
      header .right { display: flex; gap: 12px; align-items: center; opacity: 0.9; }
      header button { background: #2c2c31; color: #efeff1; border: 1px solid #3a3a3d; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
      .row { display: flex; gap: 16px; padding: 16px; }
      .panel { background: #1f1f23; border: 1px solid #303038; border-radius: 12px; padding: 16px; }
      .controls { width: 420px; }
      .control { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 8px; margin-bottom: 10px; }
      .control label { opacity: 0.8; }
      .preview { flex: 1; min-height: 320px; }
      .row2 { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      input[type="text"], input[type="number"], select {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid #3a3a3d;
        background: #151517;
        color: #efeff1;
      }
      input[type="checkbox"] { transform: scale(1.1); }
      input[type="color"] { height: 32px; }
      .time-input { max-width: 50%; }
      button { background: #9146FF; color: white; border: 0; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
      button.secondary { background: #2c2c31; color: #efeff1; border: 1px solid #3a3a3d; }
      button { transition: transform .04s ease, box-shadow .15s ease, filter .15s ease, opacity .2s; }
      button:hover { box-shadow: 0 0 0 1px #4a4a50 inset; filter: brightness(1.02); }
      button:active { transform: translateY(1px) scale(0.99); filter: brightness(0.98); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      @keyframes btnpulse { 0% { transform: scale(0.99); } 100% { transform: scale(1); } }
      .btn-click { animation: btnpulse .18s ease; }
      .url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #151517; border: 1px solid #3a3a3d; padding: 8px; border-radius: 8px; overflow: auto; }
      iframe { width: 100%; height: 360px; border: 0; background: #000; }
      .hint { font-size: 12px; opacity: 0.8; }
      .log-box { margin-top: 8px; padding: 8px; background: #151517; border: 1px solid #3a3a3d; border-radius: 8px; max-height: 160px; overflow-y: auto; font-size: 12px; }
      .log-line { margin-bottom: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
      .log-time { opacity: 0.7; margin-right: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .log-text { opacity: 0.9; }
    </style>
  </head>
  <body>
    <header>
      <div class="left">Timer Overlay Configurator</div>
      <div class="right">
        <div>Logged in as ${adminName}</div>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLSdanikaYMRTjwm9TS5HQ4zMMc8tiDRbz9dqyrJ00Zl518hxbw/viewform?usp=dialog" target="_blank" rel="noopener noreferrer" title="Send feedback or report a bug">
          <button class="secondary">Feedback</button>
        </a>
        <button id="logout">Logout</button>
      </div>
    </header>
    <div class="row">
      <div class="panel controls">
        <div class="control"><label>Overlay Key</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input id="key" type="text" value="${userKey}" readonly style="background:#151517; color:#efeff1;">
            <button class="secondary" id="rotateKey" title="Generate a new overlay key">Rotate</button>
          </div>
        </div>
        <div class="control"><label>Font Size</label><input id="fontSize" type="number" min="10" max="300" step="1" value="${
          initial.fontSize
        }"></div>
        <div class="control"><label>Color</label><input id="color" type="color" value="${
          initial.color
        }"></div>
        <div class="control"><label>Transparent</label><input id="transparent" type="checkbox" ${
          initial.transparent ? "checked" : ""
        }></div>
        <div class="control"><label>Background</label><input id="bg" type="color" value="#000000"></div>
        <div class="control"><label>Font Family</label><input id="font" type="text" value="${
          initial.font
        }"></div>
        <div class="control"><label>Show Label</label><input id="label" type="checkbox" ${
          initial.label ? "checked" : ""
        }></div>
        <div class="control"><label>Label Text</label><input id="title" type="text" value="${
          initial.title
        }"></div>
        <div class="control"><label>Align</label>
          <select id="align">
            <option ${
              initial.align === "left" ? "selected" : ""
            } value="left">left</option>
            <option ${
              initial.align === "center" ? "selected" : ""
            } value="center">center</option>
            <option ${
              initial.align === "right" ? "selected" : ""
            } value="right">right</option>
          </select>
        </div>
        <div class="control"><label>Weight</label><input id="weight" type="number" min="100" max="1000" step="100" value="${
          initial.weight
        }"></div>
        <div class="control"><label>Shadow</label><input id="shadow" type="checkbox" ${
          initial.shadow ? "checked" : ""
        }></div>
        <div class="control"><label>Shadow Color</label><input id="shadowColor" type="color" value="#000000"></div>
        <div class="control"><label>Shadow Blur</label><input id="shadowBlur" type="number" min="0" max="50" step="1" value="${
          initial.shadowBlur
        }"></div>
        <div class="control"><label>Outline Width</label><input id="stroke" type="number" min="0" max="20" step="1" value="${
          initial.stroke
        }"></div>
        <div class="control"><label>Outline Color</label><input id="strokeColor" type="color" value="#000000"></div>
        <div class="row2">
          <button class="secondary" id="presetClean">Preset: Clean</button>
          <button class="secondary" id="presetBold">Preset: Bold White</button>
          <button class="secondary" id="presetOutline">Preset: Outline</button>
          <button class="secondary" id="presetShadow">Preset: Shadow</button>
        </div>
        <div class="control"><label>Time format</label>
          <select id="timeFormat">
            <option value="mm:ss" >mm:ss</option>
            <option value="hh:mm:ss">hh:mm:ss</option>
            <option value="auto" selected>auto (hh:mm:ss when hours > 0)</option>
          </select>
        </div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin:4px 0 12px; opacity:0.85; font-weight:600;">Threshold Styling</div>
        <div class="control"><label>Warn under (sec)</label><input id="warnUnder" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>Warn color</label><input id="warnColor" type="color" value="#FFA500"></div>
        <div class="control"><label>Danger under (sec)</label><input id="dangerUnder" type="number" min="0" step="1" value="60"></div>
        <div class="control"><label>Danger color</label><input id="dangerColor" type="color" value="#FF4D4D"></div>
        <div class="control"><label>Flash under (sec)</label><input id="flashUnder" type="number" min="0" step="1" value="0"></div>
        <div class="control"><label>Hype text</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <label style="display:flex; gap:6px; align-items:center; opacity:.85;">
              <input id="hypeLabelEnabled" type="checkbox" checked /> Show
            </label>
            <input id="hypeLabel" type="text" value="🔥 Hype Train active" />
          </div>
        </div>
        <div class="control"><label>On-add effect</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <label style="display:flex; gap:6px; align-items:center; opacity:.85;">
              <input id="addEffectEnabled" type="checkbox" checked /> Enabled
            </label>
            <select id="addEffectMode" style="max-width:180px">
              <option value="pulse">Pulse</option>
              <option value="shake">Shake</option>
              <option value="bounce">Bounce</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
        <div class="row2">
          <button id="copy">Copy URL</button>
          <div class="hint">Add as a Browser Source in OBS</div>
        </div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin:4px 0 12px; opacity:0.85; font-weight:600;">Rules</div>
        <div class="control"><label>Min. Bits to Trigger</label><input id="r_bits_per" type="number" min="1" step="1" value="100"></div>
        <div class="control"><label>Bits add (sec)</label><input id="r_bits_add" type="number" min="0" step="1" value="60"></div>
        <div class="control"><label>T1 Subs add (sec)</label><input id="r_sub_1000" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>T2 Subs add (sec)</label><input id="r_sub_2000" type="number" min="0" step="1" value="600"></div>
        <div class="control"><label>T3 Subs add (sec)</label><input id="r_sub_3000" type="number" min="0" step="1" value="900"></div>
        <div class="control"><label>Resub base (sec)</label><input id="r_resub_base" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>Gift sub per-sub (sec)</label><input id="r_gift_per" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>Charity per $1 (sec)</label><input id="r_charity_per_usd" type="number" min="0" step="1" value="60"></div>
        <div class="control"><label>Follows add (sec)</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input id="r_follow_add" type="number" min="0" step="1" value="600" style="max-width:140px" />
            <label style="display:flex; gap:6px; align-items:center; opacity:.85;"><input id="r_follow_enabled" type="checkbox" /> Enabled</label>
          </div>
        </div>
        <div class="control"><label>Hype Train Modifier</label><input id="r_hype" type="number" min="0" step="0.1" value="2"></div>
        <div class="row2"><button id="saveRules">Save Rules</button></div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin:4px 0 4px; opacity:0.85; font-weight:600;">Testing Tools</div>
        <div class="row2" id="devTests">
          <button class="secondary" data-test-seconds="${
            devTest.bitsSeconds
          }" title="Simulate ${devTest.bitsPer} bits">
            Quick: ${devTest.bitsPer} bits (+${devTest.bitsSeconds}s)
          </button>
          <button class="secondary" data-test-seconds="${
            devTest.subSeconds
          }" title="Simulate Tier 1 sub">
            Quick: 1x T1 sub (+${devTest.subSeconds}s)
          </button>
          <button class="secondary" data-test-seconds="${
            devTest.giftSeconds
          }" title="Simulate single gift sub">
            Quick: 1x gift sub (+${devTest.giftSeconds}s)
          </button>
        </div>
        <div class="row2" id="devCustomSubs">
          <input id="devSubCount" type="number" min="1" step="1" value="1" style="max-width:100px" />
          <select id="devSubTier" style="max-width:160px">
            <option value="1000">Tier 1</option>
            <option value="2000">Tier 2</option>
            <option value="3000">Tier 3</option>
          </select>
          <button class="secondary" id="devApplySubs" title="Apply N subs">Apply Subs</button>
        </div>
        <div class="row2" id="devCustomGifts">
          <input id="devGiftCount" type="number" min="1" step="1" value="1" style="max-width:100px" />
          <button class="secondary" id="devApplyGifts" title="Apply N gift subs">Apply Gift Subs</button>
        </div>
        <div class="row2" id="devHypeControls">
          <button class="secondary" id="testHypeOn">Force Hype On</button>
          <button class="secondary" id="testHypeOff">Force Hype Off</button>
        </div>
      </div>
      <div class="panel preview">
        <div style="margin-bottom:8px; opacity:0.85">Live Preview</div>
        <iframe id="preview" referrerpolicy="no-referrer"></iframe>
        <div style="margin-top:8px" class="url" id="url"></div>
        <div style="margin-top:8px" class="hint">Pause/Resume and Start actions update the live overlay immediately.</div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 12px;" />
        <div style="margin:4px 0 12px; opacity:0.85; font-weight:600;">Timer Controls</div>
        <div class="control"><label>Hours</label><input id="h" class="time-input" type="number" min="0" step="1" value="${defH}"></div>
        <div class="control"><label>Minutes</label><input id="m" class="time-input" type="number" min="0" max="59" step="1" value="${defM}"></div>
        <div class="control"><label>Seconds</label><input id="s" class="time-input" type="number" min="0" max="59" step="1" value="${defS}"></div>
        <div class="control"><label>Max Stream Length</label>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; gap:8px; align-items:center;">
              <input id="maxH" type="number" min="0" step="1" value="0" style="max-width:80px">h
              <input id="maxM" type="number" min="0" max="59" step="1" value="0" style="max-width:80px">m
              <input id="maxS" type="number" min="0" max="59" step="1" value="0" style="max-width:80px">s
            </div>
            <button class="secondary" id="clearMax" title="Remove the max cap">Clear Max</button>
          </div>
        </div> 
        <div class="row2">
          <button id="startTimer">Start Timer</button>
          <button class="secondary" id="pause">Pause</button>
          <button class="secondary" id="resume">Resume</button>
          <button class="secondary" id="endTimer">End Timer</button>
          <button class="secondary" id="restartTimer">Restart Timer</button>
        </div>
        <div class="row2">
          <button class="secondary" id="saveDefault">Save Default</button>
        </div>
        <div class="row2" style="margin-top:12px;">
          <button class="secondary" data-add="300">+5 min</button>
          <button class="secondary" data-add="600">+10 min</button>
          <button class="secondary" data-add="1800">+30 min</button>
        </div>
        <div class="row2">
          <input id="addCustomSeconds" type="number" min="1" step="1" placeholder="Seconds" style="max-width:140px" />
          <button class="secondary" id="addCustomBtn">Add</button>
        </div>
        <div class="row2" id="devCustomBits">
          <input id="devBitsInput" type="number" min="0" step="1" placeholder="Bits amount (testing)" style="max-width:150px" />
          <button class="secondary" id="devApplyBits" title="Apply custom bits based on rules">Apply Bits</button>
        </div>
        <div class="hint" style="margin-top:8px">Current remaining: <span id="remain">--:--</span></div>
        <div class="hint" id="capStatus" style="margin-top:4px; opacity:0.8"></div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin-top:16px; opacity:0.85; font-weight:600;">Event Log</div>
        <div id="eventLog" class="log-box"></div>
        <div class="row2">
          <button class="secondary" id="clearLog">Clear Log</button>
        </div>
      </div>
    </div>
    <script>
      const inputs = [
        'key','fontSize','color','transparent','bg','font','label','title','align','weight','shadow','shadowColor','shadowBlur','stroke','strokeColor','timeFormat',
        'h','m','s','addEffectEnabled','addEffectMode','hypeLabelEnabled','hypeLabel'
      ].reduce((acc, id) => (acc[id] = document.getElementById(id), acc), {});

      function overlayUrl() {
        const p = new URLSearchParams();
        if (inputs.key.value) p.set('key', inputs.key.value.trim());
        return '${base}/overlay' + (p.toString() ? ('?' + p.toString()) : '');
      }

      async function saveStyle() {
        const p = new URLSearchParams();
        if (inputs.key.value) p.set('key', inputs.key.value.trim());
        const url = '${base}/api/overlay/style' + (p.toString() ? ('?' + p.toString()) : '');
        const payload = {
          fontSize: Number(inputs.fontSize.value),
          color: inputs.color.value,
          transparent: Boolean(inputs.transparent.checked),
          bg: inputs.bg.value,
          font: inputs.font.value,
          label: Boolean(inputs.label.checked),
          title: inputs.title.value,
          align: inputs.align.value,
          weight: Number(inputs.weight.value),
          shadow: Boolean(inputs.shadow.checked),
          shadowColor: inputs.shadowColor.value,
          shadowBlur: Number(inputs.shadowBlur.value),
          stroke: Number(inputs.stroke.value),
          strokeColor: inputs.strokeColor.value,
          warnUnderSeconds: Number(document.getElementById('warnUnder').value||0),
          warnColor: document.getElementById('warnColor').value,
          dangerUnderSeconds: Number(document.getElementById('dangerUnder').value||0),
          dangerColor: document.getElementById('dangerColor').value,
          flashUnderSeconds: Number(document.getElementById('flashUnder').value||0),
          timeFormat: inputs.timeFormat.value,
          addEffectEnabled: Boolean((document.getElementById('addEffectEnabled')||{}).checked),
          addEffectMode: (document.getElementById('addEffectMode')||{}).value || 'pulse',
          hypeLabelEnabled: Boolean((document.getElementById('hypeLabelEnabled')||{}).checked),
          hypeLabel: (document.getElementById('hypeLabel')||{}).value || '🔥 Hype Train active'
        };
        try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      function setBusy(btn, busy) { if (!btn) return; btn.disabled = !!busy; }
      function flashButton(btn) { if (!btn) return; btn.classList.add('btn-click'); setTimeout(() => btn.classList.remove('btn-click'), 160); }

      function totalSeconds() {
        var h = parseInt(inputs.h.value||'0',10)||0;
        var m = parseInt(inputs.m.value||'0',10)||0;
        var s = parseInt(inputs.s.value||'0',10)||0;
        if (m > 59) m = 59; if (s > 59) s = 59; if (h < 0) h = 0; if (m < 0) m = 0; if (s < 0) s = 0;
        return (h*3600)+(m*60)+s;
      }

      async function startTimer(meta) {
        var secs = totalSeconds();
        if (secs <= 0) return;
        const payload = { seconds: secs };
        if (meta && typeof meta === 'object') payload.meta = meta;
        try { await fetch('/api/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      async function addTime(secs, meta) {
        const payload = { seconds: secs };
        if (meta && typeof meta === 'object') payload.meta = meta;
        try { await fetch('/api/timer/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      async function setHypeActive(active) {
        try {
          await fetch('/api/hype', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !!active })
          });
        } catch (e) {}
      }

      function renderLog(entries) {
        const box = document.getElementById('eventLog');
        if (!box) return;
        if (!entries || !entries.length) {
          box.textContent = 'No entries yet.';
          return;
        }
        box.innerHTML = entries
          .slice()
          .reverse()
          .map(function(e) {
            var ts = e.ts ? new Date(e.ts) : new Date();
            var tStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            var src = e.type || e.source || 'event';
            var label = e.label || '';
            var base = Number(e.baseSeconds || 0);
            var applied = Number(e.appliedSeconds || 0);
            var actual = Number(e.actualSeconds || applied);
            var hype = Number(e.hypeMultiplier || 1);
            var capNote = (applied > 0 && actual < applied) ? ' (capped)' : '';
            var detail = '';
            if (src === 'channel.cheer' || src === 'channel.bits.use') {
              var bits = Number(e.bits || 0);
              if (bits > 0) detail = bits + ' bits';
            } else if (src === 'channel.subscribe' || src === 'channel.subscription.message') {
              if (e.subTier) detail = 'Tier ' + String(e.subTier).replace(/^0+/, '') || e.subTier;
            } else if (src === 'channel.subscription.gift') {
              var gifts = Number(e.giftCount || 0);
              if (gifts > 0) detail = gifts + ' gift sub' + (gifts === 1 ? '' : 's');
            } else if (src === 'channel.charity_campaign.donate') {
              var amt = Number(e.charityAmount || 0);
              var dec = Number(e.charityDecimals || 2);
              if (amt > 0) detail = '$' + (amt / Math.pow(10, dec)).toFixed(dec);
            } else if (src === 'channel.follow') {
              detail = 'Follow';
            } else if (src === 'channel.hype_train.begin') {
              detail = 'Hype Train started';
            } else if (src === 'channel.hype_train.progress') {
              detail = 'Hype Train progress';
            } else if (src === 'channel.hype_train.end') {
              detail = 'Hype Train ended';
            } else if (src === 'manual_start' || src === 'manual_add' || src === 'manual_clear' || src === 'manual_restart') {
              detail = label || (e.source || 'Manual');
            }
            var hypeInfo = hype !== 1 ? (' (base ' + base + 's ×' + hype + ')') : '';
            return '<div class="log-line"><span class="log-time">' + tStr + '</span><span class="log-text">' +
              src + (detail ? ' – ' + detail : '') + ': +' + actual + 's' + hypeInfo + capNote +
              '</span></div>';
          })
          .join('');
      }

      async function fetchLog() {
        try {
          const r = await fetch('/api/events/log', { cache: 'no-store' });
          if (!r.ok) return;
          const j = await r.json();
          renderLog(j.entries || []);
        } catch (e) {}
      }

      async function getHypeActive() {
        try { const r = await fetch('/api/hype'); const j = await r.json(); return !!j.hype; } catch(e) { return false; }
      }

      function num(v, d){ const n = Number(v); return Number.isFinite(n) ? n : d; }

      async function saveDefaultInitial() {
        var secs = totalSeconds();
        var maxH = parseInt(document.getElementById('maxH').value||'0',10)||0;
        var maxM = parseInt(document.getElementById('maxM').value||'0',10)||0;
        var maxS = parseInt(document.getElementById('maxS').value||'0',10)||0;
        if (maxM > 59) maxM = 59; if (maxS > 59) maxS = 59; if (maxH < 0) maxH = 0; if (maxM < 0) maxM = 0; if (maxS < 0) maxS = 0;
        var maxTotal = (maxH*3600)+(maxM*60)+maxS;
        const payload = { defaultInitialSeconds: secs, maxTotalSeconds: maxTotal };
        try { await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      async function saveMaxOnly(maxTotal) {
        const payload = { maxTotalSeconds: Math.max(0, parseInt(maxTotal,10)||0) };
        try { await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      function fmt(sec) {
        sec = Math.max(0, (parseInt(sec,10) || 0));
        var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
        var mm = String(m).padStart(2,'0'); var ss = String(s).padStart(2,'0');
        return (h>0? (h+':') : '') + mm + ':' + ss;
      }

      function refresh() {
        const url = overlayUrl();
        document.getElementById('url').textContent = url;
        document.getElementById('preview').src = url;
      }

      async function updateCapStatus(){
        const el = document.getElementById('capStatus');
        if (!el) return;
        try {
          const r = await fetch('/api/timer/totals', { cache: 'no-store' });
          const t = await r.json();
          const max = Number(t.maxTotalSeconds||0);
          const init = Number(t.initialSeconds||0);
          const add = Number(t.additionsTotal||0);
          const used = Math.max(0, init + add);
          if (max > 0) {
            el.textContent = 'Max: ' + fmt(max) + ' • Initial: ' + fmt(init) + ' • Added: ' + fmt(add) + ' • Total: ' + fmt(used);
          } else {
            el.textContent = 'No max set • Initial: ' + fmt(init) + ' • Added: ' + fmt(add) + ' • Total: ' + fmt(used);
          }
        } catch(e) {}
      }

      function bind() {
        for (const id in inputs) {
          const el = inputs[id];
          el.addEventListener('input', () => { saveStyle(); });
          el.addEventListener('change', () => { saveStyle(); });
        }
        document.getElementById('logout').addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = '/auth/logout?next=' + encodeURIComponent('/overlay/config');
        });
        const copyBtn = document.getElementById('copy');
        copyBtn.addEventListener('click', async (e) => {
          flashButton(copyBtn);
          const url = document.getElementById('url').textContent;
          const old = copyBtn.textContent;
          try { await navigator.clipboard.writeText(url); copyBtn.textContent = 'Copied!'; } catch(e) { copyBtn.textContent = 'Copy failed'; }
          setTimeout(() => { copyBtn.textContent = old; }, 900);
        });
        const rotateBtn = document.getElementById('rotateKey');
        rotateBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          flashButton(rotateBtn);
          if (!confirm('Rotate key? Your OBS URL will need to be updated.')) return;
          setBusy(rotateBtn, true);
          try {
            const r = await fetch('/api/overlay/key/rotate', { method: 'POST' });
            const j = await r.json();
            if (j.key) { inputs.key.value = j.key; refresh(); saveStyle(); }
          } catch (e) {}
          setBusy(rotateBtn, false);
        });
        document.getElementById('presetClean').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.color.value = '#FFFFFF';
          inputs.transparent.checked = true;
          inputs.label.checked = false;
          inputs.shadow.checked = false;
          inputs.stroke.value = 0;
          saveStyle();
        });
        document.getElementById('presetBold').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.color.value = '#FFFFFF';
          inputs.weight.value = 900;
          inputs.fontSize.value = Math.max(64, Number(inputs.fontSize.value)||64);
          inputs.transparent.checked = true;
          inputs.stroke.value = 0;
          inputs.shadow.checked = false;
          inputs.label.checked = false;
          saveStyle();
        });
        document.getElementById('presetOutline').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.color.value = '#FFFFFF';
          inputs.stroke.value = 4;
          inputs.strokeColor.value = '#000000';
          inputs.shadow.checked = false;
          inputs.transparent.checked = true;
          inputs.label.checked = false;
          saveStyle();
        });
        document.getElementById('presetShadow').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.shadow.checked = true;
          inputs.shadowColor.value = 'rgba(0,0,0,0.75)';
          inputs.shadowBlur.value = 10;
          inputs.transparent.checked = true;
          inputs.stroke.value = 0;
          inputs.label.checked = false;
          saveStyle();
        });

        // Timer controls
        document.getElementById('startTimer').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); await startTimer({ source: 'panel_start_button', label: 'Start Timer' }); await updateCapStatus(); setBusy(btn,false); });
        document.getElementById('saveDefault').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); await saveDefaultInitial(); await updateCapStatus(); setBusy(btn,false); });
        const clearMaxBtn = document.getElementById('clearMax');
        if (clearMaxBtn) {
          clearMaxBtn.addEventListener('click', async function(e){
            e.preventDefault();
            flashButton(clearMaxBtn);
            setBusy(clearMaxBtn, true);
            document.getElementById('maxH').value = 0;
            document.getElementById('maxM').value = 0;
            document.getElementById('maxS').value = 0;
            await saveMaxOnly(0);
            await updateCapStatus();
            setBusy(clearMaxBtn, false);
          });
        }
        Array.from(document.querySelectorAll('[data-add]')).forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.preventDefault();
            flashButton(btn);
            var v = parseInt(btn.getAttribute('data-add'),10)||0;
            if (v>0) {
              setBusy(btn,true);
              await addTime(v, { source: 'panel_quick_add', label: btn.textContent.trim(), requestedSeconds: v });
              await updateCapStatus();
              setBusy(btn,false);
            }
          });
        });
        // Custom add seconds
        (function(){
          const input = document.getElementById('addCustomSeconds');
          const btn = document.getElementById('addCustomBtn');
          if (!input || !btn) return;
          const doAdd = async () => {
            const v = parseInt(input.value, 10) || 0;
            if (v <= 0) return;
            flashButton(btn);
            setBusy(btn, true);
            await addTime(v, { source: 'panel_custom_add', label: 'Custom Add', requestedSeconds: v });
            await updateCapStatus();
            setBusy(btn, false);
          };
          btn.addEventListener('click', function(e){ e.preventDefault(); doAdd(); });
          input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        })();
        document.getElementById('pause').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); try { await fetch('/api/timer/pause', { method: 'POST' }); } catch(e) {} setBusy(btn,false); });
        document.getElementById('resume').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); try { await fetch('/api/timer/resume', { method: 'POST' }); } catch(e) {} setBusy(btn,false); });
        const endBtn = document.getElementById('endTimer');
        if (endBtn) {
          endBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const btn = e.currentTarget;
            flashButton(btn);
            setBusy(btn,true);
            try { await fetch('/api/timer/clear', { method: 'POST' }); } catch(e) {}
            await updateCapStatus();
            setBusy(btn,false);
          });
        }
        const restartBtn = document.getElementById('restartTimer');
        if (restartBtn) {
          restartBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const btn = e.currentTarget;
            flashButton(btn);
            setBusy(btn,true);
            try { await fetch('/api/timer/restart', { method: 'POST' }); } catch(e) {}
            await updateCapStatus();
            setBusy(btn,false);
          });
        }
        const devPanel = document.getElementById('devTests');
        if (devPanel) {
          // Expose rules for client-side calculation
          window.DEV_RULES = ${
            rulesSnapshot ? JSON.stringify(rulesSnapshot) : "null"
          };
          Array.from(devPanel.querySelectorAll('[data-test-seconds]')).forEach(function(btn){
            btn.addEventListener('click', async function(e){
              e.preventDefault();
              var secs = parseInt(btn.getAttribute('data-test-seconds'), 10) || 0;
              if (secs <= 0) return;
              var meta = { source: 'dev_quick_test', label: btn.textContent.trim(), requestedSeconds: secs };
              flashButton(btn);
              setBusy(btn, true);
              // Apply hype multiplier if active
              try {
                const hype = await getHypeActive();
                if (hype && window.DEV_RULES && window.DEV_RULES.hypeTrain) {
                  const mult = Number(window.DEV_RULES.hypeTrain.multiplier) || 1;
                  meta.hypeMultiplier = mult;
                  secs = Math.floor(secs * mult);
                }
              } catch(e) {}
              await addTime(secs, meta);
              await updateCapStatus();
              setBusy(btn, false);
            });
          });
          // Custom bits
          const bitsBtn = document.getElementById('devApplyBits');
          if (bitsBtn) bitsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const bits = num(document.getElementById('devBitsInput')?.value, 0);
            if (!window.DEV_RULES || bits <= 0) return;
            let secs = Math.floor(bits / (Number(window.DEV_RULES.bits?.per)||100)) * (Number(window.DEV_RULES.bits?.add_seconds)||0);
            const meta = { source: 'dev_custom_bits', label: 'Custom Bits', bits: bits, requestedSeconds: secs };
            const hype = await getHypeActive();
            if (hype) {
              const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1;
              meta.hypeMultiplier = mult;
              secs = Math.floor(secs * mult);
            }
            flashButton(bitsBtn); setBusy(bitsBtn,true); await addTime(secs, meta); await updateCapStatus(); setBusy(bitsBtn,false);
          });
          // Custom subs
          const subsBtn = document.getElementById('devApplySubs');
          if (subsBtn) subsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const count = Math.max(1, num(document.getElementById('devSubCount')?.value, 1));
            const tier = String(document.getElementById('devSubTier')?.value||'1000');
            if (!window.DEV_RULES) return;
            let per = Number((window.DEV_RULES.sub||{})[tier] ?? (window.DEV_RULES.sub||{})['1000'] ?? 0);
            let secs = Math.floor(count * per);
            const hype = await getHypeActive();
            const meta = { source: 'dev_custom_subs', label: 'Custom Subs', subCount: count, subTier: tier, requestedSeconds: secs };
            if (hype) {
              const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1;
              meta.hypeMultiplier = mult;
              secs = Math.floor(secs * mult);
            }
            flashButton(subsBtn); setBusy(subsBtn,true); await addTime(secs, meta); await updateCapStatus(); setBusy(subsBtn,false);
          });
          // Custom gift subs
          const giftsBtn = document.getElementById('devApplyGifts');
          if (giftsBtn) giftsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const count = Math.max(1, num(document.getElementById('devGiftCount')?.value, 1));
            if (!window.DEV_RULES) return;
            let secs = Math.floor(count * (Number(window.DEV_RULES.gift_sub?.per_sub_seconds)||0));
            const hype = await getHypeActive();
            const meta = { source: 'dev_custom_gifts', label: 'Custom Gift Subs', giftCount: count, requestedSeconds: secs };
            if (hype) {
              const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1;
              meta.hypeMultiplier = mult;
              secs = Math.floor(secs * mult);
            }
            flashButton(giftsBtn); setBusy(giftsBtn,true); await addTime(secs, meta); await updateCapStatus(); setBusy(giftsBtn,false);
          });
        }
        const hypeOnBtn = document.getElementById('testHypeOn');
        const hypeOffBtn = document.getElementById('testHypeOff');
        if (hypeOnBtn) hypeOnBtn.addEventListener('click', async function(e){ e.preventDefault(); flashButton(hypeOnBtn); setBusy(hypeOnBtn,true); await setHypeActive(true); await updateCapStatus(); setBusy(hypeOnBtn,false); });
        if (hypeOffBtn) hypeOffBtn.addEventListener('click', async function(e){ e.preventDefault(); flashButton(hypeOffBtn); setBusy(hypeOffBtn,true); await setHypeActive(false); await updateCapStatus(); setBusy(hypeOffBtn,false); });

        // Load current user settings into inputs in case server changed
        fetch('/api/user/settings').then(function(r){return r.json();}).then(function(j){
          var secs = Number(j.defaultInitialSeconds||0);
          inputs.h.value = Math.floor(secs/3600);
          inputs.m.value = Math.floor((secs%3600)/60);
          inputs.s.value = secs%60;
          var max = Number(j.maxTotalSeconds||0);
          document.getElementById('maxH').value = Math.floor(max/3600);
          document.getElementById('maxM').value = Math.floor((max%3600)/60);
          document.getElementById('maxS').value = max%60;
        }).catch(function(){});

        // Load current style thresholds to sync controls
        (function(){
          var u = '/api/overlay/style';
          var key = inputs.key.value.trim();
          if (key) { u += '?key=' + encodeURIComponent(key); }
          fetch(u, { cache: 'no-store' }).then(function(r){return r.json();}).then(function(s){
            try {
              if (typeof s.warnUnderSeconds !== 'undefined') document.getElementById('warnUnder').value = Number(s.warnUnderSeconds)||0;
              if (typeof s.warnColor !== 'undefined') document.getElementById('warnColor').value = s.warnColor || '#FFA500';
              if (typeof s.dangerUnderSeconds !== 'undefined') document.getElementById('dangerUnder').value = Number(s.dangerUnderSeconds)||0;
              if (typeof s.dangerColor !== 'undefined') document.getElementById('dangerColor').value = s.dangerColor || '#FF4D4D';
              if (typeof s.flashUnderSeconds !== 'undefined') document.getElementById('flashUnder').value = Number(s.flashUnderSeconds)||0;
              if (typeof s.timeFormat !== 'undefined') document.getElementById('timeFormat').value = (s.timeFormat==='hh:mm:ss' || s.timeFormat==='auto') ? s.timeFormat : 'mm:ss';
              if (document.getElementById('addEffectEnabled')) {
                document.getElementById('addEffectEnabled').checked =
                  (typeof s.addEffectEnabled === 'boolean') ? s.addEffectEnabled : true;
              }
              if (document.getElementById('addEffectMode')) {
                document.getElementById('addEffectMode').value = s.addEffectMode || 'pulse';
              }
              if (document.getElementById('hypeLabelEnabled')) {
                document.getElementById('hypeLabelEnabled').checked =
                  (typeof s.hypeLabelEnabled === 'boolean') ? s.hypeLabelEnabled : true;
              }
              if (document.getElementById('hypeLabel')) {
                document.getElementById('hypeLabel').value = s.hypeLabel || '🔥 Hype Train active';
              }
            } catch(e) {}
          }).catch(function(){});
        })();

        // Show current remaining
        function updateRemain(){ fetch('/api/timer/state').then(function(r){return r.json();}).then(function(j){ document.getElementById('remain').textContent = fmt(j.remaining||0); }).catch(function(){}); }
        updateRemain(); setInterval(updateRemain, 1000);
        updateCapStatus(); setInterval(updateCapStatus, 3000);

        // Load rules and populate inputs
        fetch('/api/rules').then(r=>r.json()).then(function(rr){
          try {
            if (rr && rr.bits) {
              document.getElementById('r_bits_per').value = rr.bits.per ?? 100;
              document.getElementById('r_bits_add').value = rr.bits.add_seconds ?? 60;
            }
            if (rr && rr.sub) {
              document.getElementById('r_sub_1000').value = rr.sub['1000'] ?? 300;
              if (document.getElementById('r_sub_2000')) document.getElementById('r_sub_2000').value = rr.sub['2000'] ?? 600;
              if (document.getElementById('r_sub_3000')) document.getElementById('r_sub_3000').value = rr.sub['3000'] ?? 900;
            }
            if (rr && rr.resub) {
              if (document.getElementById('r_resub_base')) document.getElementById('r_resub_base').value = rr.resub.base_seconds ?? 300;
            }
            if (rr && rr.gift_sub) {
              if (document.getElementById('r_gift_per')) document.getElementById('r_gift_per').value = rr.gift_sub.per_sub_seconds ?? 300;
            }
            if (rr && rr.charity) {
              if (document.getElementById('r_charity_per_usd')) document.getElementById('r_charity_per_usd').value = rr.charity.per_usd ?? 60;
            }
            if (rr && rr.follow) {
              const add = Number(rr.follow.add_seconds ?? 600);
              const enabled = Boolean(rr.follow.enabled);
              if (document.getElementById('r_follow_add')) document.getElementById('r_follow_add').value = add;
              if (document.getElementById('r_follow_enabled')) document.getElementById('r_follow_enabled').checked = enabled;
            }
            if (rr && rr.hypeTrain) {
              document.getElementById('r_hype').value = rr.hypeTrain.multiplier ?? 2;
            }
          } catch (e) {}
        }).catch(function(){});

        // Save rules
        document.getElementById('saveRules').addEventListener('click', async function(e){
          e.preventDefault();
          const body = {
            bits: { per: Number(document.getElementById('r_bits_per').value||100), add_seconds: Number(document.getElementById('r_bits_add').value||60) },
            sub: {
              '1000': Number(document.getElementById('r_sub_1000').value||300),
              '2000': Number((document.getElementById('r_sub_2000')||{}).value||600),
              '3000': Number((document.getElementById('r_sub_3000')||{}).value||900)
            },
            resub: { base_seconds: Number((document.getElementById('r_resub_base')||{}).value||300) },
            gift_sub: { per_sub_seconds: Number((document.getElementById('r_gift_per')||{}).value||300) },
            charity: { per_usd: Number((document.getElementById('r_charity_per_usd')||{}).value||60) },
            follow: { enabled: Boolean((document.getElementById('r_follow_enabled')||{}).checked), add_seconds: Number((document.getElementById('r_follow_add')||{}).value||600) },
            hypeTrain: { multiplier: Number(document.getElementById('r_hype').value||2) }
          };
          try { await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch(e) {}
        });

        // (rules UI removed)

        const clearLogBtn = document.getElementById('clearLog');
        if (clearLogBtn) {
          clearLogBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(clearLogBtn);
            try { await fetch('/api/events/log/clear', { method: 'POST' }); } catch (err) {}
            renderLog([]);
          });
        }

        setInterval(fetchLog, 5000);
      }

      bind();
      refresh();
      saveStyle();
    </script>
  </body>
</html>\`;
`;

  return html;
}
