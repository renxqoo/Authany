import type { AnyAccessClaims } from "./auth.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderLoginPage(error?: string): string {
  const errorHtml = error
    ? `<div style="color:#c0392b;background:#fdecea;padding:8px 12px;border-radius:4px;margin-bottom:16px">${escapeHtml(error)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Login - Target Service</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}
    .card{background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);padding:32px;width:100%;max-width:380px}
    h1{font-size:20px;margin-bottom:24px;color:#333}
    label{display:block;font-size:14px;color:#555;margin-bottom:4px}
    input[type=text],input[type=password]{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;margin-bottom:16px}
    button{width:100%;padding:10px;background:#3498db;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer}
    button:hover{background:#2980b9}
  </style>
</head>
<body>
  <div class="card">
    <h1>Target Service Login</h1>
    ${errorHtml}
    <form method="POST" action="/login">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required autofocus>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required>
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`;
}

export function renderIndexPage(claims: AnyAccessClaims, token: string): string {
  const isLocal = claims.iss === "target-service-local";
  const localClaims = isLocal ? claims as { username: string; display_name: string } : null;
  const sdkClaims = !isLocal ? claims as { agent_id?: string; delegation_type?: string } : null;

  const userInfoHtml = isLocal
    ? `<tr><td>Issuer</td><td>Local</td></tr>
       <tr><td>Username</td><td>${escapeHtml(localClaims!.username)}</td></tr>
       <tr><td>Display Name</td><td>${escapeHtml(localClaims!.display_name)}</td></tr>`
    : `<tr><td>Issuer</td><td>SDK (AuthAny)</td></tr>
       <tr><td>Agent ID</td><td>${escapeHtml(sdkClaims!.agent_id ?? "N/A")}</td></tr>
       <tr><td>Delegation</td><td>${escapeHtml(sdkClaims!.delegation_type ?? "N/A")}</td></tr>`;

  const apiLinks = [
    { name: "Finance Summary", path: "/api/resources/finance-summary" },
    { name: "Stock List", path: "/api/resources/stock-list" },
    { name: "Market Overview", path: "/api/resources/market-overview" },
    { name: "Index Daily", path: "/api/resources/index-daily" },
    { name: "Limit Up Stats", path: "/api/resources/limit-up-stats" },
    { name: "Dragon Tiger", path: "/api/resources/dragon-tiger" },
    { name: "Concept List", path: "/api/resources/concept-list" },
  ];

  const linksHtml = apiLinks
    .map((link) => `<li><a href="${link.path}">${escapeHtml(link.name)}</a></li>`)
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Target Service</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f5;padding:24px}
    .card{background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);padding:24px;margin-bottom:16px}
    h1{font-size:20px;margin-bottom:16px;color:#333}
    h2{font-size:16px;margin-bottom:12px;color:#555}
    table{width:100%;border-collapse:collapse}
    td{padding:6px 0;font-size:14px;color:#444}
    td:first-child{font-weight:600;color:#333;width:140px}
    ul{list-style:none;padding:0}
    li{padding:6px 0}
    a{color:#3498db;text-decoration:none;font-size:14px}
    a:hover{text-decoration:underline}
    form{display:inline}
    .logout-btn{padding:8px 16px;background:#e74c3c;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer;margin-top:8px}
    .logout-btn:hover{background:#c0392b}
    .token-box{background:#f9f9f9;border:1px solid #ddd;border-radius:4px;padding:8px;font-family:monospace;font-size:12px;word-break:break-all;margin-top:8px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Target Service</h1>
    <h2>User Info</h2>
    <table>
      <tr><td>Subject</td><td>${escapeHtml(claims.sub)}</td></tr>
      ${userInfoHtml}
    </table>
    <form method="POST" action="/logout">
      <button class="logout-btn" type="submit">Sign Out</button>
    </form>
  </div>

  <div class="card">
    <h2>API Resources</h2>
    <ul>
      ${linksHtml}
    </ul>
  </div>

  <div class="card">
    <h2>Bearer Token</h2>
    <div class="token-box">${escapeHtml(token)}</div>
  </div>
</body>
</html>`;
}
