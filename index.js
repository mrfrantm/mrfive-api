const express = require('express')
const session = require('express-session')
const { createClient } = require('@supabase/supabase-js')

const app = express()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}))

function requireLogin(req, res, next) {
  if (!req.session.logged) return res.redirect('/login')
  next()
}

function pageStyle() {
  return `
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#0b1220;color:#fff}
    a{color:#a78bfa}
    .wrap{padding:32px}
    .login-body{height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0b1220,#111827)}
    .login-card{background:#111827;padding:32px;border-radius:18px;width:380px;box-shadow:0 20px 50px rgba(0,0,0,.45)}
    input{width:100%;padding:13px;border-radius:10px;border:1px solid #334155;background:#020617;color:#fff}
    button{padding:13px 18px;border:0;border-radius:10px;background:#7c3aed;color:#fff;font-weight:bold;cursor:pointer}
    .danger{background:#ef4444}
    .gray{background:#475569}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:24px}
    .card{background:#111827;padding:22px;border-radius:18px;box-shadow:0 12px 35px rgba(0,0,0,.25);margin-bottom:20px}
    .stat-title{color:#94a3b8;font-size:14px}
    .stat-num{font-size:32px;font-weight:bold;margin-top:8px}
    .row{display:flex;gap:10px;align-items:center}
    .row input{flex:1}
    h1,h2{margin-top:0}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{padding:11px;border-bottom:1px solid #334155;text-align:left;font-size:14px}
    th{color:#cbd5e1}
    .ok{color:#22c55e;font-weight:bold}
    .bad{color:#ef4444;font-weight:bold}
    .warn{color:#f59e0b;font-weight:bold}
    .empty{color:#94a3b8}
    .keyitem{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1f2937}
    @media(max-width:900px){.grid{grid-template-columns:1fr}.row{flex-direction:column}}
  </style>`
}

app.get('/login', (req, res) => {
  res.send(`
  <html>
  <head>${pageStyle()}</head>
  <body class="login-body">
    <form class="login-card" method="POST">
      <h1>MRFIVE Panel</h1>
      <p style="color:#94a3b8">Acceso privado al sistema de licencias</p>
      <input type="password" name="password" placeholder="Contraseña" required />
      <button style="width:100%;margin-top:14px">Entrar</button>
    </form>
  </body>
  </html>
  `)
})

app.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.logged = true
    return res.redirect('/')
  }
  res.send('Contraseña incorrecta')
})

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'))
})

app.get('/', requireLogin, async (req, res) => {
  const search = (req.query.search || '').toLowerCase()

  const { data: licenses } = await supabase.from('licenses').select('*').order('key', { ascending: true })
  const { data: banned } = await supabase.from('banned').select('*').order('key', { ascending: true })
  const { data: logs } = await supabase.from('logs').select('*').order('id', { ascending: false })

  const safeLicenses = licenses || []
  const safeBanned = banned || []
  let safeLogs = logs || []

  if (search) {
    safeLogs = safeLogs.filter(l =>
      (l.key || '').toLowerCase().includes(search) ||
      (l.resource || '').toLowerCase().includes(search)
    )
  }

  const okLogs = safeLogs.filter(l => l.result === 'OK').length
  const failLogs = safeLogs.length - okLogs

  const resultClass = r => {
    if (r === 'OK') return 'ok'
    if (r === 'OUTDATED') return 'warn'
    return 'bad'
  }

  res.send(`
  <html>
  <head>
    <title>MRFIVE License Dashboard</title>
    ${pageStyle()}
  </head>
  <body>
    <div class="wrap">

      <div class="top">
        <div>
          <h1>MRFIVE License Dashboard</h1>
          <p style="color:#94a3b8">Panel de control de licencias y uso</p>
        </div>
        <a href="/logout">Cerrar sesión</a>
      </div>

      <div class="grid">
        <div class="card"><div class="stat-title">Licencias autorizadas</div><div class="stat-num ok">${safeLicenses.length}</div></div>
        <div class="card"><div class="stat-title">Licencias baneadas</div><div class="stat-num bad">${safeBanned.length}</div></div>
        <div class="card"><div class="stat-title">Logs OK</div><div class="stat-num ok">${okLogs}</div></div>
        <div class="card"><div class="stat-title">Logs fallidos</div><div class="stat-num bad">${failLogs}</div></div>
      </div>

      <div class="card">
        <h2>Añadir licencia</h2>
        <form class="row" method="POST" action="/add-license">
          <input name="key" placeholder="cfxk_xxxx" required>
          <button type="submit">Añadir</button>
        </form>
      </div>

      <div class="card">
        <h2>Banear licencia</h2>
        <form class="row" method="POST" action="/ban-license">
          <input name="key" placeholder="cfxk_xxxx" required>
          <button class="danger" type="submit">Banear</button>
        </form>
      </div>

      <div class="card">
        <h2>Buscar logs</h2>
        <form class="row" method="GET" action="/">
          <input name="search" value="${search}" placeholder="Buscar por key o resource">
          <button type="submit">Buscar</button>
          <a href="/">Limpiar</a>
        </form>
      </div>

      <div class="card">
        <h2 class="ok">Licencias autorizadas</h2>
        ${safeLicenses.length ? safeLicenses.map(l => `
          <div class="keyitem">
            <strong>${l.key}</strong>
            <a href="/delete-license/${encodeURIComponent(l.key)}">Quitar</a>
          </div>
        `).join('') : `<p class="empty">No hay licencias autorizadas.</p>`}
      </div>

      <div class="card">
        <h2 class="bad">Licencias baneadas</h2>
        ${safeBanned.length ? safeBanned.map(l => `
          <div class="keyitem">
            <strong>${l.key}</strong>
            <a href="/unban/${encodeURIComponent(l.key)}">Desbanear</a>
          </div>
        `).join('') : `<p class="empty">No hay licencias baneadas.</p>`}
      </div>

      <div class="card">
        <h2>Logs (${safeLogs.length})</h2>
        <form method="POST" action="/clear-logs" onsubmit="return confirm('¿Seguro que quieres limpiar todos los logs?')">
          <button class="danger">Limpiar logs</button>
        </form>

        <table>
          <tr>
            <th>Fecha</th><th>Resultado</th><th>Key</th><th>Resource</th><th>Versión</th><th>IP</th>
          </tr>
          ${safeLogs.map(l => `
            <tr>
              <td>${l.date || ''}</td>
              <td class="${resultClass(l.result)}">${l.result || ''}</td>
              <td>${l.key || ''}</td>
              <td>${l.resource || ''}</td>
              <td>${l.version || ''}</td>
              <td>${l.ip || ''}</td>
            </tr>
          `).join('')}
        </table>
      </div>

    </div>
  </body>
  </html>
  `)
})

app.post('/add-license', requireLogin, async (req, res) => {
  const key = (req.body.key || '').trim()
  if (!key) return res.redirect('/')

  const { error } = await supabase.from('licenses').upsert([{ key }], { onConflict: 'key' })
  await supabase.from('banned').delete().eq('key', key)

  if (error) console.log('ERROR INSERT LICENSE:', error)
  else console.log('LICENCIA AÑADIDA:', key)

  res.redirect('/')
})

app.get('/delete-license/:key', requireLogin, async (req, res) => {
  await supabase.from('licenses').delete().eq('key', req.params.key)
  res.redirect('/')
})

app.post('/ban-license', requireLogin, async (req, res) => {
  const key = (req.body.key || '').trim()
  if (!key) return res.redirect('/')

  await supabase.from('banned').upsert([{ key }], { onConflict: 'key' })
  await supabase.from('licenses').delete().eq('key', key)

  res.redirect('/')
})

app.get('/unban/:key', requireLogin, async (req, res) => {
  await supabase.from('banned').delete().eq('key', req.params.key)
  res.redirect('/')
})

app.post('/clear-logs', requireLogin, async (req, res) => {
  await supabase.from('logs').delete().neq('id', 0)
  res.redirect('/')
})

async function verifyLicense(req, res) {
  const { token, key, resource, version } = req.query
  let result = 'NO_AUTH'

  if (token && token !== process.env.MRFIVE_TOKEN) {
    result = 'INVALID_TOKEN'
  } else {
    const { data: license } = await supabase.from('licenses').select('*').eq('key', key)
    const { data: banned } = await supabase.from('banned').select('*').eq('key', key)

    if ((banned || []).length > 0) result = 'BANNED'
    else if ((license || []).length > 0) result = 'OK'

    if (version !== process.env.CURRENT_VERSION) result = 'OUTDATED'
  }

  await supabase.from('logs').insert([{
    result,
    key,
    resource,
    version,
    ip: req.headers['x-forwarded-for'] || req.ip
  }])

  res.send(result)
}

app.get('/verify', verifyLicense)
app.get('/check', verifyLicense)

const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log('API running on', PORT))
