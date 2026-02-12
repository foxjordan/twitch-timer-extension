export function renderSoundAlertOverlayPage() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sound Alert Overlay</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: transparent;
        overflow: hidden;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #fff;
      }
      #alerts {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column-reverse;
        gap: 8px;
        max-width: 360px;
        pointer-events: none;
      }
      .alert-popup {
        background: rgba(20, 20, 28, 0.92);
        border: 1px solid rgba(145, 70, 255, 0.4);
        border-radius: 12px;
        padding: 12px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(145, 70, 255, 0.15);
        animation: slideIn 0.35s ease-out;
        pointer-events: none;
      }
      .alert-popup.exit {
        animation: fadeOut 0.3s ease-in forwards;
      }
      .alert-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #9146FF, #772CE8);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .alert-text {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
        text-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .alert-sub {
        font-size: 12px;
        font-weight: 400;
        opacity: 0.65;
        margin-top: 2px;
      }
      @keyframes slideIn {
        from { transform: translateX(40px); opacity: 0; }
        to   { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to   { opacity: 0; transform: translateY(8px); }
      }
    </style>
  </head>
  <body>
    <div id="alerts"></div>
    <script>
      (function(){
        var qs = new URLSearchParams(window.location.search);
        var overlayKey = qs.get('key') || '';
        if (!overlayKey) {
          var msg = document.createElement('p');
          msg.style.cssText = 'color:#f44;padding:20px';
          msg.textContent = 'Missing overlay key';
          document.body.appendChild(msg);
          return;
        }

        var maxQueue = 5;
        var displayMs = 5000;
        var alertsEl = document.getElementById('alerts');
        var audioQueue = [];
        var isPlaying = false;

        function playNext() {
          if (isPlaying || !audioQueue.length) return;
          isPlaying = true;
          var item = audioQueue.shift();

          showPopup(item.soundName);

          var vol = Math.min(1, Math.max(0, (item.volume || 100) / 100));
          var audio = new Audio('/api/sounds/file/' + encodeURIComponent(item.soundId) + '?key=' + encodeURIComponent(overlayKey));
          audio.volume = vol;
          audio.onended = function() { isPlaying = false; playNext(); };
          audio.onerror = function() { isPlaying = false; playNext(); };
          audio.play().catch(function() { isPlaying = false; playNext(); });
        }

        function showPopup(name) {
          var el = document.createElement('div');
          el.className = 'alert-popup';

          var icon = document.createElement('div');
          icon.className = 'alert-icon';
          icon.textContent = '\\u{1F50A}';
          el.appendChild(icon);

          var textWrap = document.createElement('div');
          var nameEl = document.createElement('div');
          nameEl.className = 'alert-text';
          nameEl.textContent = name || 'Sound Alert';
          textWrap.appendChild(nameEl);

          var subEl = document.createElement('div');
          subEl.className = 'alert-sub';
          subEl.textContent = 'Sound Alert';
          textWrap.appendChild(subEl);

          el.appendChild(textWrap);
          alertsEl.appendChild(el);

          setTimeout(function() {
            el.classList.add('exit');
            setTimeout(function() { el.remove(); }, 350);
          }, displayMs);
        }

        // Connect to SSE
        var es = new EventSource('/api/overlay/stream?key=' + encodeURIComponent(overlayKey));

        es.addEventListener('sound_alert', function(ev) {
          try {
            var data = JSON.parse(ev.data);
            if (!data.soundId || !data.soundName) return;
            if (audioQueue.length >= maxQueue) return;
            audioQueue.push(data);
            playNext();
          } catch (e) {}
        });

        es.addEventListener('sound_settings', function(ev) {
          try {
            var data = JSON.parse(ev.data);
            if (typeof data.maxQueueSize === 'number') maxQueue = data.maxQueueSize;
            if (typeof data.overlayDurationMs === 'number') displayMs = data.overlayDurationMs;
          } catch (e) {}
        });

        es.onerror = function() {};
      })();
    </script>
  </body>
</html>`;
}