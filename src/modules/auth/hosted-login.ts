export function normalizeReturnTo(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/";
  }
  return value;
}

export function renderHostedLoginPage(input: { returnTo: string; csrfToken: string; error?: string }) {
  const returnTo = escapeHtml(input.returnTo);
  const csrfToken = escapeHtml(input.csrfToken);
  const error = input.error ? `<div class="error">${escapeHtml(input.error)}</div>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in to AuthAny</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg, #f8fafc, #e0f2fe); font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; }
      main { width: min(420px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,.8); border-radius: 28px; background: rgba(255,255,255,.82); box-shadow: 0 24px 80px rgba(15,23,42,.12); padding: 32px; backdrop-filter: blur(16px); }
      p { margin: 8px 0 0; color: #64748b; line-height: 1.6; }
      h1 { margin: 12px 0 0; font-size: 30px; letter-spacing: -0.04em; }
      label { display: block; margin-top: 18px; font-size: 14px; font-weight: 650; }
      input { box-sizing: border-box; width: 100%; height: 44px; margin-top: 6px; border: 1px solid #cbd5e1; border-radius: 14px; padding: 0 12px; font-size: 14px; }
      button { width: 100%; height: 44px; margin-top: 22px; border: 0; border-radius: 14px; background: #020617; color: white; font-weight: 750; cursor: pointer; }
      .eyebrow { color: #0284c7; font-size: 12px; text-transform: uppercase; letter-spacing: .22em; font-weight: 800; }
      .error { margin-top: 16px; border: 1px solid #fecaca; border-radius: 14px; background: #fef2f2; color: #b91c1c; padding: 10px 12px; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">AuthAny Hosted Login</div>
      <h1>Sign in to continue</h1>
      <p>Authenticate with AuthAny, then return to the requesting application.</p>
      ${error}
      <form method="post" action="/login">
        <input type="hidden" name="return_to" value="${returnTo}" />
        <input type="hidden" name="csrf_token" value="${csrfToken}" />
        <label>Username<input name="username" autocomplete="username" /></label>
        <label>Password<input name="password" autocomplete="current-password" type="password" /></label>
        <button type="submit">Sign in with AuthAny</button>
      </form>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
