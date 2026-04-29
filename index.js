const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const TOKEN = "MRFIVE_X9kL_2026_SECURE_TOKEN_8372";
const ADMIN_PASSWORD = "MrFran_2026PanelSecure!92";

const CURRENT_VERSION = "2.0";

let licenses = [
  "cfxk_18poudQxLTpZfNdRQpm4U_4Yb1yw"
];

let banned = [];
let logs = [];

app.get("/check", (req, res) => {
  const { token, key, resource, version } = req.query;

  const log = {
    date: new Date().toLocaleString(),
    ip: req.ip,
    key: key || "",
    resource: resource || "",
    version: version || "",
    result: ""
  };

  if (token !== TOKEN) {
    log.result = "INVALID_TOKEN";
    logs.unshift(log);
    return res.send("INVALID_TOKEN");
  }

  if (banned.includes(key)) {
    log.result = "BANNED";
    logs.unshift(log);
    return res.send("BANNED");
  }

  if (!licenses.includes(key)) {
    log.result = "NO_AUTH";
    logs.unshift(log);
    return res.send("NO_AUTH");
  }

  if (version !== CURRENT_VERSION) {
    log.result = "OUTDATED";
    logs.unshift(log);
    return res.send("OUTDATED");
  }

  log.result = "OK";
  logs.unshift(log);
  return res.send("OK");
});

app.get("/", (req, res) => {
  res.redirect("/admin");
});

app.get("/admin", (req, res) => {
  const pass = req.query.pass;

  if (pass !== ADMIN_PASSWORD) {
    return res.send(`
      <h2>MRFIVE Admin Login</h2>
      <form method="GET" action="/admin">
        <input name="pass" type="password" placeholder="Password">
        <button>Entrar</button>
      </form>
    `);
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>MRFIVE License Panel</title>
  <style>
    body { font-family: Arial; background:#0f172a; color:white; padding:30px; }
    .card { background:#111827; padding:20px; border-radius:12px; margin-bottom:20px; }
    input { padding:10px; width:70%; }
    button { padding:10px 15px; cursor:pointer; }
    .ok { color:#22c55e; }
    .bad { color:#ef4444; }
    table { width:100%; border-collapse:collapse; }
    td, th { border-bottom:1px solid #334155; padding:8px; text-align:left; }
  </style>
</head>
<body>

<h1>MRFIVE License Panel</h1>

<div class="card">
  <h2>Añadir licencia</h2>
  <form method="POST" action="/add?pass=${pass}">
    <input name="key" placeholder="cfxk_xxxxx">
    <button>Añadir</button>
  </form>
</div>

<div class="card">
  <h2>Banear licencia</h2>
  <form method="POST" action="/ban?pass=${pass}">
    <input name="key" placeholder="cfxk_xxxxx">
    <button>Banear</button>
  </form>
</div>

<div class="card">
  <h2 class="ok">Licencias autorizadas (${licenses.length})</h2>
  ${licenses.map(k => `
    <form method="POST" action="/remove?pass=${pass}">
      ${k}
      <button name="key" value="${k}">Quitar</button>
    </form>
  `).join("")}
</div>

<div class="card">
  <h2 class="bad">Licencias baneadas (${banned.length})</h2>
  ${banned.map(k => `
    <form method="POST" action="/unban?pass=${pass}">
      ${k}
      <button name="key" value="${k}">Desbanear</button>
    </form>
  `).join("")}
</div>

<div class="card">
  <h2>Logs (${logs.length})</h2>
  <table>
    <tr>
      <th>Fecha</th>
      <th>Resultado</th>
      <th>Key</th>
      <th>Resource</th>
      <th>Versión</th>
      <th>IP</th>
    </tr>
    ${logs.slice(0, 100).map(l => `
      <tr>
        <td>${l.date}</td>
        <td>${l.result}</td>
        <td>${l.key}</td>
        <td>${l.resource}</td>
        <td>${l.version}</td>
        <td>${l.ip}</td>
      </tr>
    `).join("")}
  </table>
</div>

</body>
</html>
  `);
});

app.post("/add", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.send("NO_AUTH");

  const key = req.body.key?.trim();
  if (key && !licenses.includes(key)) licenses.push(key);
  banned = banned.filter(k => k !== key);

  res.redirect("/admin?pass=" + req.query.pass);
});

app.post("/remove", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.send("NO_AUTH");

  licenses = licenses.filter(k => k !== req.body.key);
  res.redirect("/admin?pass=" + req.query.pass);
});

app.post("/ban", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.send("NO_AUTH");

  const key = req.body.key?.trim();
  if (key && !banned.includes(key)) banned.push(key);
  licenses = licenses.filter(k => k !== key);

  res.redirect("/admin?pass=" + req.query.pass);
});

app.post("/unban", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.send("NO_AUTH");

  banned = banned.filter(k => k !== req.body.key);
  res.redirect("/admin?pass=" + req.query.pass);
});

app.listen(PORT, () => {
  console.log("API running on port " + PORT);
});
