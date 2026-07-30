export function renderPromptOverlayPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Prompt Overlay</title>
    <style>
      :root { color-scheme: dark; }
      html, body { height: 100%; }
      body { margin: 0; background: transparent; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: flex-end; justify-content: center; padding: 40px; box-sizing: border-box; }
      .prompt-card {
        max-width: min(720px, 90vw);
        padding: 18px 28px;
        border-radius: 14px;
        background: rgba(15, 15, 18, 0.82);
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        color: #f8fafc;
        font-size: 26px;
        font-weight: 700;
        line-height: 1.4;
        text-align: center;
        opacity: 0;
        transform: translateY(12px);
        transition: opacity .35s ease, transform .35s ease;
      }
      .prompt-card.visible { opacity: 1; transform: translateY(0); }
      .prompt-eyebrow { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #a78bfa; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <div class="prompt-card" id="promptCard">
      <span class="prompt-eyebrow">Chat Prompt</span>
      <span id="promptText"></span>
    </div>
    <script>
      (function(){
        const qs = new URLSearchParams(window.location.search);
        const overlayKey = qs.get('key') || '';
        const card = document.getElementById('promptCard');
        const textEl = document.getElementById('promptText');

        function showPrompt(text) {
          if (!text) {
            card.classList.remove('visible');
            return;
          }
          textEl.textContent = text;
          // Re-trigger the transition even if the same text is shown again.
          card.classList.remove('visible');
          void card.offsetWidth;
          card.classList.add('visible');
        }

        function handlePayload(payload) {
          if (!payload) return;
          showPrompt(String(payload.text || ''));
        }

        if (!overlayKey) return;

        (function connectSSE() {
          var retryDelay = 4000;
          const streamUrl = '/api/overlay/stream?key=' + encodeURIComponent(overlayKey);
          const source = new EventSource(streamUrl);

          source.addEventListener('open', () => { retryDelay = 4000; });

          source.addEventListener('prompt_show', (event) => {
            if (!event || !event.data) return;
            try { handlePayload(JSON.parse(event.data)); } catch (e) {}
          });

          source.addEventListener('error', () => {
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
