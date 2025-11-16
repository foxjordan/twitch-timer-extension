export function renderLoggedOutPage(options = {}) {
  const base = String(options.base || "");
  const next = options.next || "/overlay/config";
  const encodedNext = encodeURIComponent(String(next));

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Logged out</title>
<style>body{margin:0;font-family:system-ui,Arial;background:#0e0e10;color:#efeff1;display:flex;align-items:center;justify-content:center;height:100vh}
.box{background:#1f1f23;border:1px solid #303038;border-radius:12px;padding:24px;max-width:520px}
button{background:#9146FF;color:#fff;border:0;padding:10px 14px;border-radius:8px;cursor:pointer}</style>
</head><body>
<div class="box">
  <h2 style="margin:0 0 8px">You are logged out</h2>
  <p style="opacity:.85;margin:0 0 16px">To sign in again, click the button below.</p>
  <a href="${base}/auth/login?next=${encodedNext}"><button>Sign in with Twitch</button></a>
  <div style="opacity:.7;font-size:12px;margin-top:10px">Note: you may still be signed into Twitch in this browser, which can auto-complete sign-in.</div>
</div>
</body></html>`;
}
