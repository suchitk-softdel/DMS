// Writes every table of the local database to db-view.html and opens it in
// the browser, so the data can be checked without a database tool.
// Run with: npm run db:view   (the HTML file is git-ignored: it contains data)
import { exec } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT_DIR } from '../src/config/env.js'
import { prisma } from '../src/db/prisma.js'

const LIMIT = 200
const tables = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name`)
const esc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
let nav = '', body = ''
for (const { name } of tables) {
  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "${name}"`)
  let rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${name}" LIMIT ${LIMIT}`)
  const cols = rows.length ? Object.keys(rows[0]).filter((c) => c !== 'passwordHash') : []
  nav += `<a href="#${name}">${name} <small>${n}</small></a>`
  body += `<section id="${name}"><h2>${name} <small>${n} rows${Number(n) > LIMIT ? `, showing first ${LIMIT}` : ''}</small></h2><div class="wrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c] instanceof Date ? r[c].toISOString().slice(0, 16).replace('T', ' ') : r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`
}
const html = `<!doctype html><html><head><meta charset="utf-8"><title>dev.db tables</title><style>
body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#F3F4F8;color:#1B1F3B;display:flex}
nav{width:230px;flex-shrink:0;background:#161B4B;min-height:100vh;position:sticky;top:0;height:100vh;overflow:auto;padding:16px 0}
nav h1{color:#fff;font-size:16px;margin:0 16px 12px}nav a{display:flex;justify-content:space-between;color:#fff;text-decoration:none;padding:7px 16px;font-size:14px}nav a:hover{background:#00A896}nav small{opacity:.7}
main{flex:1;min-width:0;padding:20px 28px}h2{color:#047F8C;font-size:18px;margin:28px 0 10px}h2 small{color:#5B6275;font-weight:400;font-size:13px}
.wrap{overflow:auto;max-height:480px;background:#fff;border:1px solid #DCDFE8;border-radius:8px}
table{border-collapse:collapse;font-size:13px;white-space:nowrap}th{position:sticky;top:0;background:#E9EBF2;text-align:left;padding:8px 12px}td{padding:6px 12px;border-top:1px solid #EEF0F5}
</style></head><body><nav><h1>dev.db tables</h1>${nav}</nav><main><p>Snapshot of <b>dealer-app-backend/dev.db</b> taken ${new Date().toLocaleString()}. Password hashes are hidden.</p>${body}</main></body></html>`
const outFile = path.join(ROOT_DIR, 'db-view.html')
writeFileSync(outFile, html)
console.log(`Wrote ${tables.length} tables to ${outFile}`)
await prisma.$disconnect()

// Open in the default browser.
const opener = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open'
exec(`${opener} "${outFile}"`)
