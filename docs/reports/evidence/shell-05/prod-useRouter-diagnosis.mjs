import { connectRenderer } from '/home/nathan/Project/nao-todo/scripts/electron-smoke/lib/cdp.mjs'
const cdp = await connectRenderer({ port: 9333, urlMatch: 'index.html' })
const out = await cdp.evaluate(`
  const app = document.getElementById('app').__vue_app__
  const chunkURL = new URL('./assets/vender/vue-router-DrofmNyp.js', location.href).href
  const mod = await import(chunkURL)
  const exported = Object.keys(mod).sort()
  const results = {}
  for (const k of exported) {
    if (typeof mod[k] !== 'function') continue
    let val, err = null
    try { val = app.runWithContext(() => mod[k]()) } catch (e) { err = String(e.message) }
    results[k] = err
      ? { call: 'THREW', err }
      : { call: 'OK', type: typeof val, valIsUndefined: val === undefined, isRouter: !!(val && val.currentRoute), sameAsGlobal: val === app.config.globalProperties.$router }
  }
  return { exported, results, globalRouter: app.config.globalProperties.$router ? 'defined' : 'undefined' }
`)
console.log(JSON.stringify(out, null, 2))
cdp.close()