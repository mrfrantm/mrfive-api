const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// 🔐 TOKEN SECRETO (igual que en Lua)
const TOKEN = "MRFIVE_X9kL_2026_SECURE_TOKEN_8372";

// 📦 VERSION ACTUAL
const CURRENT_VERSION = "2.0";

// 🧠 BASE DE DATOS (simple)
let licenses = [
    "cfxk_18poudQxLTpZfNdRQpm4U_4Yb1yw"
];

let banned = [];

// 📊 LOGS
let logs = [];

app.get("/check", (req, res) => {
    const { token, key, resource, version } = req.query;

    // LOG intento
    logs.push({
        key,
        resource,
        version,
        ip: req.ip,
        date: new Date()
    });

    // 🔐 VALIDAR TOKEN
    if (token !== TOKEN) {
        return res.send("INVALID_TOKEN");
    }

    // 🚫 BANEADO
    if (banned.includes(key)) {
        return res.send("BANNED");
    }

    // ❌ NO AUTORIZADO
    if (!licenses.includes(key)) {
        return res.send("NO_AUTH");
    }

    // ⚠️ VERSION ANTIGUA
    if (version !== CURRENT_VERSION) {
        return res.send("OUTDATED");
    }

    // ✅ OK
    return res.send("OK");
});

// 🔥 PANEL SIMPLE
app.get("/", (req, res) => {
    res.send(`
    <h1>MRFIVE API</h1>
    <p>Licencias: ${licenses.length}</p>
    <p>Baneados: ${banned.length}</p>
    <p>Logs: ${logs.length}</p>
    `);
});

app.listen(PORT, () => {
    console.log("API running on port " + PORT);
});
