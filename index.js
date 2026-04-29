const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 10000;

// =====================
// ENV (Render)
// =====================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// =====================
// SUPABASE CLIENT
// =====================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
  })
);

// =====================
// LOGIN SIMPLE
// =====================
app.post("/login", (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    req.session.auth = true;
    return res.json({ ok: true });
  }

  return res.status(401).json({ error: "Incorrect password" });
});

function auth(req, res, next) {
  if (req.session.auth) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// =====================
// DASHBOARD DATA
// =====================
app.get("/stats", auth, async (req, res) => {
  const { data: licenses } = await supabase.from("licenses").select("*");
  const { data: banned } = await supabase.from("banned").select("*");
  const { data: logs } = await supabase.from("logs").select("*");

  const safeLogs = logs || [];

  const okLogs = safeLogs.filter((l) => l?.result === "OK").length;
  const failLogs = safeLogs.filter((l) => l?.result !== "OK").length;

  res.json({
    licenses: licenses?.length || 0,
    banned: banned?.length || 0,
    okLogs,
    failLogs,
  });
});

// =====================
// ADD LICENSE
// =====================
app.post("/license/add", auth, async (req, res) => {
  const { key } = req.body;

  if (!key) return res.status(400).json({ error: "Missing key" });

  const { data, error } = await supabase
    .from("licenses")
    .insert([{ key }]);

  console.log("ADD LICENSE:", { data, error });

  res.json({ ok: true });
});

// =====================
// BAN LICENSE
// =====================
app.post("/license/ban", auth, async (req, res) => {
  const { key } = req.body;

  if (!key) return res.status(400).json({ error: "Missing key" });

  await supabase.from("banned").insert([{ key }]);

  res.json({ ok: true });
});

// =====================
// LOG REQUEST
// =====================
app.post("/log", async (req, res) => {
  const { key, result, resource, version, ip } = req.body;

  await supabase.from("logs").insert([
    {
      key,
      result,
      resource,
      version,
      ip,
      date: new Date(),
    },
  ]);

  res.json({ ok: true });
});

// =====================
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.send("MRFIVE API RUNNING 🚀");
});

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
  console.log("API running on port", PORT);
});
