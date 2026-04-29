const express = require("express");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const TOKEN = process.env.MRFIVE_TOKEN || "MRFIVE_X9kL_2026_SECURE_TOKEN_8372";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MrFran_2026PanelSecure";
const CURRENT_VERSION = process.env.CURRENT_VERSION || "2.0";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "mrfive_session_secret",
  resave: false,
  saveUninitialized: false
}));

function requireLogin(req, res, next) {
  if (!req.session.logged) return res.redirect("/login");
  next();
}

async function addLog(result, key, resource, version, ip) {
  const { error } = await supabase.from("logs").insert({
    result: result || "",
    key: key || "",
    resource: resource || "",
    version: version || "",
    ip: ip || ""
  });

  if (error) {
    console.log("ERROR ADD LOG:", error);
  }
}

app.get("/check", async (req, res) => {
  const { token, key, resource, version } = req.query;
  const ip = req.headers["x-forwarded-for"] || req.ip || "";

  if (token !== TOKEN) {
    await addLog("INVALID_TOKEN", key, resource, version, ip);
    return res.send("INVALID_TOKEN");
  }

  const { data: bannedKey, error: bannedError } = await supabase
    .from("banned")
    .select("key")
    .eq("key", key || "")
    .maybeSingle();

  if (bannedError) console.log("ERROR CHECK BANNED:", bannedError);

  if (bannedKey) {
    await addLog("BANNED", key, resource, version, ip);
    return res.send("BANNED");
  }

  const { data: license, error: licenseError } = await supabase
    .from("licenses")
    .select("key")
    .eq("key", key || "")
    .maybeSingle();

  if (licenseError) console.log("ERROR CHECK LICENSE:", licenseError);

  if (!license) {
    await addLog("NO_AUTH", key, resource, version, ip);
    return res.send("NO_AUTH");
  }

  if (version !== CURRENT_VERSION) {
    await addLog("OUTDATED", key, resource, version, ip);
    return res.send("OUTDATED");
  }

  await addLog("OK", key, resource, version, ip);
  return res.send("OK");
});

app.get("/", (req, res) => res.redirect("/admin"));

app.get("/login", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>MRFIVE Login</title>
<style>
body{font-family:Arial;background:#0f172a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
form{background:#111827;padding:30px;border-radius:16px;width:360px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
input,button{width:100%;padding:12px;margin-top:12px;border-radius:8px;border:0;box-sizing:border-box}
button{background:#7c3aed;color:white;font-weight:bold;cursor:pointer}
</style>
</head>
<body>
<form method="POST" action="/login">
<h2>MRFIVE Panel</h2>
<input type="password" name="password" placeholder="Contraseña">
<button>Entrar</button>
</form>
</body>
</html>
`);
});

app.post("/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.logged = true;
    return res.redirect("/admin");
  }
  return res.send("Contraseña incorrecta");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/admin", requireLogin, async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();

  const { data: licenses, error: licensesError } = await supabase
    .from("licenses")
    .select("*")
    .order("key", { ascending: true });

  const { data: banned, error: bannedError } = await supabase
    .from("banned")
    .select("*")
    .order("key", { ascending: true });

  const { data: rawLogs, error: logsError } = await supabase
    .from("logs")
    .select("*")
    .order("id", { ascending: false })
    .limit(300);

  if (licensesError) console.log("ERROR LOAD LICENSES:", licensesError);
  if (bannedError) console.log("ERROR LOAD BANNED:", bannedError);
  if (logsError) console.log("ERROR LOAD LOGS:", logsError);

  let filteredLogs = rawLogs || [];

  if (q) {
    filteredLogs = filteredLogs.filter(l =>
      (l.key || "").toLowerCase().includes(q) ||
      (l.resource || "").toLowerCase().includes(q)
    );
  }

  const okLogs = filteredLogs.filter(l => l.result === "OK").length;
  const badLogs = filteredLogs.filter(l => l.result !== "OK").length;

  function resultColor(result) {
    if (result === "OK") return "#22c55e";
    if (result === "OUTDATED") return "#f59e0b";
    if (result === "NO_AUTH") return "#ef4444";
    if (result === "BANNED") return "#dc2626";
    if (result === "INVALID_TOKEN") return "#a855f7";
    return "#94a3b8";
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>MRFIVE License Dashboard</title>
<style>
body{font-family:Arial;background:#0f172a;color:white;margin:0;padding:30px}
h1{margin-top:0}
a{color:#c4b5fd}
.card{background:#111827;padding:20px;border-radius:16px;margin-bottom:20px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
input{padding:12px;border-radius:8px;border:0;width:70%;box-sizing:border-box}
button{padding:12px 16px;border:0;border-radius:8px;background:#7c3aed;color:white;font-weight:bold;cursor:pointer}
button.danger{background:#dc2626}
button.gray{background:#475569}
table{width:100%;border-collapse:collapse}
td,th{border-bottom:1px solid #334155;padding:10px;text-align:left;font-size:14px}
.small{font-size:13px;color:#94a3b8}
.keyline{display:flex;gap:10px;align-items:center;margin:8px 0}
.empty{color:#94a3b8;font-style:italic}
</style>
</head>
<body>

<h1>MRFIVE License Dashboard</h1>
<p><a href="/logout">Cerrar sesión</a></p>

<div class="grid">
  <div class="card"><div class="small">Licencias autorizadas</div><h1>${(licenses || []).length}</h1></div>
  <div class="card"><div class="small">Licencias baneadas</div><h1>${(banned || []).length}</h1></div>
  <div class="card"><div class="small">Logs OK</div><h1 style="color:#22c55e">${okLogs}</h1></div>
  <div class="card"><div class="small">Logs fallidos</div><h1 style="color:#ef4444">${badLogs}</h1></div>
</div>

<div class="card">
<h2>Añadir licencia</h2>
<form method="POST" action="/add">
<input name="key" placeholder="cfxk_xxxxx" required>
<button>Añadir</button>
</form>
</div>

<div class="card">
<h2>Banear licencia</h2>
<form method="POST" action="/ban">
<input name="key" placeholder="cfxk_xxxxx" required>
<button class="danger">Banear</button>
</form>
</div>

<div class="card">
<h2>Buscar logs</h2>
<form method="GET" action="/admin">
<input name="q" value="${q}" placeholder="Buscar por key o resource">
<button>Buscar</button>
<a href="/admin">Limpiar búsqueda</a>
</form>
</div>

<div class="card">
<h2 style="color:#22c55e">Autorizadas</h2>
${(licenses || []).length ? (licenses || []).map(l => `
  <form class="keyline" method="POST" action="/remove">
    <strong>${l.key}</strong>
    <button class="gray" name="key" value="${l.key}">Quitar</button>
  </form>
`).join("") : `<p class="empty">No hay licencias autorizadas.</p>`}
</div>

<div class="card">
<h2 style="color:#ef4444">Baneadas</h2>
${(banned || []).length ? (banned || []).map(l => `
  <form class="keyline" method="POST" action="/unban">
    <strong>${l.key}</strong>
    <button name="key" value="${l.key}">Desbanear</button>
  </form>
`).join("") : `<p class="empty">No hay licencias baneadas.</p>`}
</div>

<div class="card">
<h2>Logs (${filteredLogs.length})</h2>
<form method="POST" action="/clear-logs" onsubmit="return confirm('¿Seguro que quieres borrar todos los logs?');">
<button class="danger">Limpiar logs</button>
</form>
<br>
<table>
<tr>
<th>Fecha</th><th>Resultado</th><th>Key</th><th>Resource</th><th>Versión</th><th>IP</th>
</tr>
${filteredLogs.map(l => `
<tr>
<td>${new Date(l.date || l.created_at).toLocaleString()}</td>
<td style="color:${resultColor(l.result)};font-weight:bold">${l.result}</td>
<td>${l.key || ""}</td>
<td>${l.resource || ""}</td>
<td>${l.version || ""}</td>
<td>${l.ip || ""}</td>
</tr>
`).join("")}
</table>
</div>

</body>
</html>
`);
});

app.post("/add", requireLogin, async (req, res) => {
  const key = (req.body.key || "").trim();

  if (!key) return res.redirect("/admin");

  const { error: insertError } = await supabase
    .from("licenses")
    .upsert({ key }, { onConflict: "key" });

  if (insertError) {
    console.log("ERROR INSERT LICENSE:", insertError);
  } else {
    console.log("LICENCIA AÑADIDA:", key);
  }

  const { error: deleteBanError } = await supabase
    .from("banned")
    .delete()
    .eq("key", key);

  if (deleteBanError) {
    console.log("ERROR DELETE FROM BANNED:", deleteBanError);
  }

  res.redirect("/admin");
});

app.post("/remove", requireLogin, async (req, res) => {
  const key = (req.body.key || "").trim();

  const { error } = await supabase
    .from("licenses")
    .delete()
    .eq("key", key);

  if (error) console.log("ERROR REMOVE LICENSE:", error);

  res.redirect("/admin");
});

app.post("/ban", requireLogin, async (req, res) => {
  const key = (req.body.key || "").trim();

  if (!key) return res.redirect("/admin");

  const { error: insertBanError } = await supabase
    .from("banned")
    .upsert({ key }, { onConflict: "key" });

  if (insertBanError) {
    console.log("ERROR INSERT BANNED:", insertBanError);
  } else {
    console.log("LICENCIA BANEADA:", key);
  }

  const { error: deleteLicenseError } = await supabase
    .from("licenses")
    .delete()
    .eq("key", key);

  if (deleteLicenseError) {
    console.log("ERROR DELETE FROM LICENSES:", deleteLicenseError);
  }

  res.redirect("/admin");
});

app.post("/unban", requireLogin, async (req, res) => {
  const key = (req.body.key || "").trim();

  const { error } = await supabase
    .from("banned")
    .delete()
    .eq("key", key);

  if (error) console.log("ERROR UNBAN:", error);

  res.redirect("/admin");
});

app.post("/clear-logs", requireLogin, async (req, res) => {
  const { error } = await supabase
    .from("logs")
    .delete()
    .neq("id", 0);

  if (error) console.log("ERROR CLEAR LOGS:", error);

  res.redirect("/admin");
});

app.listen(PORT, () => {
  console.log("MRFIVE API running on port " + PORT);
});
