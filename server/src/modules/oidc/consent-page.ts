export interface ConsentPageInput {
  clientName: string;
  clientId: string;
  csrfToken: string;
  scopeItems: string[];
  values: Record<string, string | undefined>;
}

export function renderConsentPage(input: ConsentPageInput) {
  const fields = Object.entries(input.values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value ?? "")}" />`)
    .join("\n        ");
  const csrfToken = escapeHtml(input.csrfToken);
  const scopes = input.scopeItems
    .map((scope) => `<li>${escapeHtml(scopeLabel(scope))}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authorize ${escapeHtml(input.clientName)}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg, #eff6ff, #f8fafc); font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; }
      main { width: min(520px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,.9); border-radius: 30px; background: rgba(255,255,255,.88); box-shadow: 0 28px 90px rgba(15,23,42,.14); padding: 34px; backdrop-filter: blur(18px); }
      .eyebrow { color: #0369a1; font-size: 12px; text-transform: uppercase; letter-spacing: .22em; font-weight: 850; }
      h1 { margin: 14px 0 0; font-size: 30px; letter-spacing: -0.04em; }
      p { color: #64748b; line-height: 1.65; }
      ul { margin: 18px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
      li { border: 1px solid #dbeafe; border-radius: 16px; background: #f8fbff; padding: 12px 14px; color: #164e63; font-weight: 650; }
      .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 26px; }
      button { height: 44px; border-radius: 14px; font-weight: 800; cursor: pointer; }
      .allow { border: 0; background: #020617; color: white; }
      .deny { border: 1px solid #cbd5e1; background: white; color: #334155; }
      code { border-radius: 8px; background: #f1f5f9; padding: 2px 6px; }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">AuthAny Authorization</div>
      <h1>Authorize ${escapeHtml(input.clientName)}</h1>
      <p><code>${escapeHtml(input.clientId)}</code> wants permission to use your AuthAny identity.</p>
      <ul>${scopes}</ul>
      <form method="post" action="/oauth/consent">
        ${fields}
        <input type="hidden" name="csrf_token" value="${csrfToken}" />
        <div class="actions">
          <button class="deny" type="submit" name="decision" value="deny">Deny</button>
          <button class="allow" type="submit" name="decision" value="allow">Authorize</button>
        </div>
      </form>
    </main>
  </body>
</html>`;
}

function scopeLabel(scope: string) {
  const labels: Record<string, string> = {
    openid: "Confirm your AuthAny account identity",
    profile: "Read your basic profile",
    email: "Read your email address",
    offline_access: "Keep this app signed in with refresh access"
  };
  return labels[scope] ?? `Access scope: ${scope}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
