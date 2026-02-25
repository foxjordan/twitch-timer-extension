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
      /* Video/clip container */
      .media-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(145, 70, 255, 0.2);
        z-index: 10;
        animation: scaleIn 0.3s ease-out;
      }
      .media-container video {
        display: block;
        max-width: 640px;
        max-height: 360px;
      }
      .media-container iframe {
        display: block;
        border: none;
      }
      .media-container.exit {
        animation: fadeOut 0.3s ease-in forwards;
      }
      @keyframes scaleIn {
        from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
        to   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
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
        var alertQueue = [];
        var isPlaying = false;

        function advance() {
          isPlaying = false;
          playNext();
        }

        function playNext() {
          if (isPlaying || !alertQueue.length) return;
          isPlaying = true;
          var item = alertQueue.shift();
          var type = item.type || 'sound';

          if (type === 'clip') {
            playClip(item);
          } else if (type === 'video') {
            playVideo(item);
          } else {
            playSound(item);
          }
        }

        function playSound(item) {
          showPopup(item.soundName, 'sound');
          var vol = Math.min(1, Math.max(0, (item.volume || 100) / 100));
          var audio = new Audio('/api/sounds/file/' + encodeURIComponent(item.soundId) + '?key=' + encodeURIComponent(overlayKey));
          audio.volume = vol;
          audio.onended = advance;
          audio.onerror = advance;
          audio.play().catch(advance);
        }

        function playClip(item) {
          showPopup(item.soundName, 'clip');
          var slug = item.clipSlug;
          if (!slug) { advance(); return; }

          var container = document.createElement('div');
          container.className = 'media-container';

          var iframe = document.createElement('iframe');
          iframe.src = 'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(slug)
            + '&parent=' + encodeURIComponent(window.location.hostname)
            + '&autoplay=true&muted=false';
          iframe.width = '640';
          iframe.height = '360';
          iframe.allow = 'autoplay';
          container.appendChild(iframe);
          document.body.appendChild(container);

          setTimeout(function() {
            container.classList.add('exit');
            setTimeout(function() { container.remove(); advance(); }, 350);
          }, displayMs);
        }

        function playVideo(item) {
          showPopup(item.soundName, 'video');
          var vol = Math.min(1, Math.max(0, (item.volume || 100) / 100));

          var container = document.createElement('div');
          container.className = 'media-container';

          var video = document.createElement('video');
          video.src = '/api/sounds/file/' + encodeURIComponent(item.soundId) + '?key=' + encodeURIComponent(overlayKey);
          video.volume = vol;
          video.autoplay = true;
          video.playsInline = true;

          video.onended = function() {
            container.classList.add('exit');
            setTimeout(function() { container.remove(); advance(); }, 350);
          };
          video.onerror = function() {
            container.remove();
            advance();
          };

          container.appendChild(video);
          document.body.appendChild(container);

          // Safety timeout in case video hangs
          setTimeout(function() {
            if (container.parentNode) {
              try { video.pause(); } catch(e) {}
              container.classList.add('exit');
              setTimeout(function() { container.remove(); advance(); }, 350);
            }
          }, Math.max(displayMs, 30000));

          video.play().catch(function() { container.remove(); advance(); });
        }

        function showPopup(name, type) {
          var el = document.createElement('div');
          el.className = 'alert-popup';

          var icon = document.createElement('div');
          icon.className = 'alert-icon';
          if (type === 'clip') {
            icon.textContent = '\\u{1F3AC}';
          } else if (type === 'video') {
            icon.textContent = '\\u{1F4F9}';
          } else {
            icon.textContent = '\\u{1F50A}';
          }
          el.appendChild(icon);

          var textWrap = document.createElement('div');
          var nameEl = document.createElement('div');
          nameEl.className = 'alert-text';
          nameEl.textContent = name || 'Alert';
          textWrap.appendChild(nameEl);

          var subEl = document.createElement('div');
          subEl.className = 'alert-sub';
          if (type === 'clip') {
            subEl.textContent = 'Clip Alert';
          } else if (type === 'video') {
            subEl.textContent = 'Video Alert';
          } else {
            subEl.textContent = 'Sound Alert';
          }
          textWrap.appendChild(subEl);

          el.appendChild(textWrap);
          alertsEl.appendChild(el);

          setTimeout(function() {
            el.classList.add('exit');
            setTimeout(function() { el.remove(); }, 350);
          }, displayMs);
        }

        // Connect to SSE with reconnect + exponential backoff
        (function connectSSE() {
          var retryDelay = 4000;
          var es = new EventSource('/api/overlay/stream?key=' + encodeURIComponent(overlayKey));

          es.addEventListener('open', function() { retryDelay = 4000; });

          es.addEventListener('sound_alert', function(ev) {
            try {
              var data = JSON.parse(ev.data);
              if (!data.soundId || !data.soundName) return;
              if (alertQueue.length >= maxQueue) return;
              alertQueue.push(data);
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

          es.onerror = function() {
            es.close();
            setTimeout(connectSSE, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 60000);
          };
        })();
      })();
    </script>
  </body>
</html>`;
}
