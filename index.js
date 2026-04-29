const express = require('express')
const session = require('express-session')
const { createClient } = require('@supabase/supabase-js')

const app = express()

// ===== ENV =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ===== MIDDLEWARE =====
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))

// ===== AUTH =====
function requireLogin(req, res, next) {
  if (!req.session.logged) return res.redirect('/login')
  next()
}

// ===== LOGIN =====
app.get('/login', (req, res) => {
  res.send(`
  <html>
  <body style="background:#0b1320;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
    <form method="POST" style="background:#111827;padding:30px;border-radius:10px;">
      <h2>MRFIVE Panel</h2>
      <input type="password" name="password" placeholder="Contraseña" style="padding:10px;width:100%;margin-bottom:10px;">
      <button style="padding:10px;width:100%;">Entrar</button>
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

// ===== PANEL =====
app.get('/', requireLogin, async (req, res) => {

  const { data: licenses } = await supabase.from('licenses').select('*')
  const { data: banned } = await supabase.from('banned').select('*')
  const { data: logs } = await supabase.from('logs').select('*').order('id', { ascending: false })

  const safeLicenses = licenses || []
  const safeBanned = banned || []
  const safeLogs = logs || []

  const okLogs = safeLogs.filter(l => l.result === 'OK').length
  const failLogs = safeLogs.length - okLogs

  res.send(`
  <html>
  <body style="background:#0b1320;color:white;font-family:sans-serif;padding:30px;">

  <h1>MRFIVE License Dashboard</h1>
  <a href="/logout" style="color:#a78bfa;">Cerrar sesión</a>

  <div style="display:flex;gap:20px;margin-top:20px;">
    <div>Licencias: ${safeLicenses.length}</div>
    <div>Baneadas: ${safeBanned.length}</div>
    <div>Logs OK: ${okLogs}</div>
    <div>Logs fallidos: ${failLogs}</div>
  </div>

  <h2>Añadir licencia</h2>
  <form method="POST" action="/add-license">
    <input name="key" placeholder="cfxk_xxxx" required>
    <button>Añadir</button>
  </form>

  <h2>Banear licencia</h2>
  <form method="POST" action="/ban-license">
    <input name="key" placeholder="cfxk_xxxx" required>
    <button>Banear</button>
  </form>

  <h2>Licencias autorizadas</h2>
  ${safeLicenses.map(l => `
    <div>
      ${l.key}
      <a href="/delete-license/${l.key}" style="color:red;">❌</a>
    </div>
  `).join('') || '<p>No hay licencias</p>'}

  <h2>Licencias baneadas</h2>
  ${safeBanned.map(l => `
    <div>
      ${l.key}
      <a href="/unban/${l.key}" style="color:orange;">♻️</a>
    </div>
  `).join('') || '<p>No hay baneadas</p>'}

  <h2>Logs</h2>
  <table border="1" cellpadding="5">
    <tr>
      <th>Fecha</th><th>Resultado</th><th>Key</th><th>Resource</th><th>Versión</th>
    </tr>
    ${safeLogs.map(l => `
      <tr style="color:${l.result === 'OK' ? 'lime' : (l.result === 'OUTDATED' ? 'orange' : 'red')};">
        <td>${l.date || ''}</td>
        <td>${l.result}</td>
        <td>${l.key}</td>
        <td>${l.resource}</td>
        <td>${l.version}</td>
      </tr>
    `).join('')}
  </table>

  </body>
  </html>
  `)
})

// ===== ADD =====
app.post('/add-license', async (req, res) => {
  const { key } = req.body
  if (!key) return res.redirect('/')

  await supabase.from('licenses').insert([{ key }])
  res.redirect('/')
})

// ===== DELETE =====
app.get('/delete-license/:key', async (req, res) => {
  await supabase.from('licenses').delete().eq('key', req.params.key)
  res.redirect('/')
})

// ===== BAN =====
app.post('/ban-license', async (req, res) => {
  const { key } = req.body

  await supabase.from('banned').insert([{ key }])
  await supabase.from('licenses').delete().eq('key', key)

  res.redirect('/')
})

// ===== UNBAN =====
app.get('/unban/:key', async (req, res) => {
  await supabase.from('banned').delete().eq('key', req.params.key)
  res.redirect('/')
})

// ===== VERIFY =====
app.get('/verify', async (req, res) => {

  const { key, resource, version } = req.query

  let result = 'NO_AUTH'

  const { data: license } = await supabase.from('licenses').select('*').eq('key', key)
  const { data: banned } = await supabase.from('banned').select('*').eq('key', key)

  if ((banned || []).length > 0) result = 'BANNED'
  else if ((license || []).length > 0) result = 'OK'

  if (version !== process.env.CURRENT_VERSION) {
    result = 'OUTDATED'
  }

  await supabase.from('logs').insert([{
    result,
    key,
    resource,
    version,
    ip: req.ip
  }])

  res.json({ status: result })
})

// ===== START =====
const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log('API running on', PORT))
