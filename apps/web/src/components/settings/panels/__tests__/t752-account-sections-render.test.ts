// @vitest-environment node
import { execSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import { build } from 'vite-plus'
import vue from '@vitejs/plugin-vue'

/**
 * `T752` · 账户面板四分区 / 密码分区去底色的**渲染后实测**（真 Vite 构建 + 真 Vue 运行时 +
 * 真主题 + headless Chromium）
 *
 * 为什么必须真浏览器：`jsdom` **无布局引擎** —— `getBoundingClientRect()` 恒 0、不加载 SFC 样式、
 * 不算 CSS 变量 ⇒ 「密码表单左缘与相邻行同基线」「窄屏可用宽 +24」「块无底色/无内边距/无圆角」
 * 这三类**只能**在真浏览器里量（设计稿 §3c / §3d）。
 *
 * 做法：把**真组件**（`account-panel.vue` + 其依赖的真组件）用 Vite 打成一个小页面，
 * 样式表**逐字取自** `settings/dialog/index.vue` 的 `<style>`（生产同一份，无重写），
 * Chromium 加载后：
 * ① 先断言「窗口活着」（`clientHeight > 0`）—— 新 target 无布局视口时几何全 0，会静默假成立；
 * ② `getComputedStyle` / `getBoundingClientRect` 实测左轴线、宽度、计算样式；
 * ③ 注入「旧版 12px 块内边距」对照，实测「右移 12 / 窄屏少 24」的差量（判据有牙）。
 *
 * 缺 Chromium 的环境（CI）⇒ **skip**（不是失败）；本机有则必跑。
 * 夹具目录在 **仓库外**（`$TMPDIR/t752-sections-probe`，跑完删）。
 * @see docs/designs/360-settings-polish.md（§1 四分区 / §3c 密码分区 B 方案 / §3d 间距台阶）
 */

const REPO = resolve(import.meta.dirname, '../../../../../../..')
const WEB_SRC = join(REPO, 'apps/web/src')
const EXECUTABLE = ((): string => {
    for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
        try {
            const found = execSync(`command -v ${name}`, { encoding: 'utf8' }).trim()
            if (found) return found
        } catch {
            // 继续找下一个
        }
    }
    return ''
})()

const describeRender = EXECUTABLE ? describe : describe.skip

/** Vite 构建 + Chromium 起停 ⇒ 单例给 120s（CI 无 Chromium 时整体 skip） */
const PROBE_TIMEOUT = 120_000

const PROBE_DIR = join(tmpdir(), 't752-sections-probe')

const PAGE_SCRIPT = String.raw`
window.__qa = (() => {
  const px = (value) => Number.parseFloat(value) || 0
  const round = (value) => Math.round(value * 100) / 100
  const panel = () => document.querySelector('[data-settings-category="account"]')
  const heads = () => Array.from(document.querySelectorAll('[data-settings-section]'))
  const block = (id) => document.querySelector('[data-setting-id="' + id + '"]')
  const form = () => document.querySelector('.settings-password')
  const profile = () => document.querySelector('.settings-profile')
  const token = (name) => {
    const probe = document.createElement('div')
    probe.style.fontSize = 'var(' + name + ')'
    probe.style.paddingLeft = 'var(' + name + ')'
    document.body.appendChild(probe)
    const style = getComputedStyle(probe)
    const value = { fontSize: px(style.fontSize), paddingLeft: px(style.paddingLeft) }
    probe.remove()
    return value
  }
  const rect = (el) => {
    if (!el) return null
    const box = el.getBoundingClientRect()
    return { left: round(box.left), right: round(box.right), width: round(box.width), height: round(box.height) }
  }
  const measure = () => {
    const root = panel()
    const passwordBlock = block('password')
    const style = passwordBlock ? getComputedStyle(passwordBlock) : null
    const passwordForm = form()
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      panel: { clientHeight: root ? root.clientHeight : 0, clientWidth: root ? root.clientWidth : 0 },
      heads: heads().map((head) => {
        const title = head.querySelector('h3.sd-group__title')
        const desc = head.querySelector('p.sd-group__desc')
        const titleStyle = title ? getComputedStyle(title) : null
        return {
          id: head.getAttribute('data-settings-section'),
          title: title ? (title.textContent || '').trim() : '',
          desc: desc ? (desc.textContent || '').trim() : '',
          titleLeft: rect(title) ? rect(title).left : null,
          descLeft: rect(desc) ? rect(desc).left : null,
          fontSize: titleStyle ? px(titleStyle.fontSize) : 0,
          fontWeight: titleStyle ? titleStyle.fontWeight : ''
        }
      }),
      passwordBlock: passwordBlock
        ? {
              rect: rect(passwordBlock),
              backgroundColor: style.backgroundColor,
              padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
              borderRadius: style.borderRadius,
              borderTopWidth: px(style.borderTopWidth),
              boxShadow: style.boxShadow
          }
        : null,
      passwordForm: rect(passwordForm),
      /** 密码表单到内容块之间的每一层：都必须是「无底色 / 无内边距 / 无圆角」容器
          （防把旧 sd-password__body 换个类名加回来） */
      passwordAncestors: (() => {
        const chain = []
        let node = passwordForm ? passwordForm.parentElement : null
        while (node && node !== document.body) {
          const nodeStyle = getComputedStyle(node)
          const isBlock = node.getAttribute('data-setting-id') === 'password'
          chain.push({
            className: String(node.className || '').slice(0, 48),
            isBlock,
            backgroundColor: nodeStyle.backgroundColor,
            padding: [
              nodeStyle.paddingTop,
              nodeStyle.paddingRight,
              nodeStyle.paddingBottom,
              nodeStyle.paddingLeft
            ],
            borderRadius: nodeStyle.borderRadius
          })
          if (isBlock) break
          node = node.parentElement
        }
        return chain
      })(),
      passwordLabel: (() => {
        const label = document.querySelector('[data-setting-id="password"] .nue-text--label')
        return label ? { color: getComputedStyle(label).color, left: rect(label).left } : null
      })(),
      /** 面板内 label 的**默认**色（nue-ui 主题对 .nue-text--label 的值）——不硬编码 rgb */
      labelToken: (() => {
        const probe = document.createElement('span')
        probe.className = 'nue-text--label'
        probe.textContent = 'x'
        document.body.appendChild(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })(),
      /** 旧版为压 -100 浅底而覆写的 -700 —— 用于证明 label 确已回到 -600 */
      primary700Color: (() => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--nue-primary-color-700)'
        probe.textContent = 'x'
        document.body.appendChild(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })(),
      /** label 的目标色 = --nue-primary-color-600（themes/div.css 的 form-item 口径） */
      primary600Color: (() => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--nue-primary-color-600)'
        probe.textContent = 'x'
        document.body.appendChild(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })(),
      profileContent: rect(profile()),
      sessionsBlock: rect(block('sessions')),
      tokens: {
        textLg: token('--nue-text-lg').fontSize,
        paddingSm: token('--nue-padding-sm').paddingLeft,
        paddingDf: token('--nue-padding-df').paddingLeft
      },
      sessionTitles: {
        byClass: document.querySelectorAll('.session-manager__title').length,
        exactText: Array.from(document.querySelectorAll('*')).filter(
          (el) => (el.textContent || '').trim() === '登录设备' && el.children.length === 0
        ).length
      }
    }
  }
  /** 对照：把「旧版 12px 块内边距」加回去（B 方案的代价来源），量完立刻撤销 */
  const withOldPadding = (callback) => {
    const passwordBlock = block('password')
    if (!passwordBlock) return null
    const before = { form: rect(form()), block: rect(passwordBlock) }
    passwordBlock.style.paddingLeft = '12px'
    passwordBlock.style.paddingRight = '12px'
    const after = { form: rect(form()), block: rect(passwordBlock) }
    passwordBlock.style.paddingLeft = ''
    passwordBlock.style.paddingRight = ''
    return { before, after, callback: callback || null }
  }
  return { measure, withOldPadding }
})()
window.__qaIsReady = false
const raf = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
const ready = async () => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await raf()
    const root = document.querySelector('[data-settings-category="account"]')
    const form = document.querySelector('.settings-password')
    // 先断言「窗口活着」：没有布局视口时 clientHeight 恒 0（几何会静默全 0）
    if (root && root.clientHeight > 0 && form && form.getBoundingClientRect().left > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return true
    }
  }
  return false
}
ready().then((ok) => {
  window.__qaIsReady = ok
})
true
`

/** main.ts：真组件 + 假用例（挂载即取数的叶子返回空；⛔ 不桩掉样式与 DOM 结构） */
const mainTs = (): string => `import '${join(WEB_SRC, 'themes/index.ts')}'
import './settings.css'
import { createApp, defineComponent, h, provide, ref } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '${join(REPO, 'packages/shared/locales/index.ts')}'
import { nueUI } from '${join(WEB_SRC, 'nue-ui-register.ts')}'
import { useUserStore } from '${join(REPO, 'packages/presentation-identity/index.ts')}'
import AccountPanel from '${join(WEB_SRC, 'components/settings/panels/account-panel.vue')}'
import { SETTINGS_VIEW_CONTEXT_KEY } from '${join(WEB_SRC, 'components/settings/context.ts')}'

/**
 * 假用例：只提供「挂载即调用」的两个方法（改密 / 会话列表）。
 * 不桩组件 ⇒ 面板 DOM、样式、布局全是真的（桩掉等于自己证明自己）。
 */
const userUseCase = {
    loadSessions: async () => [[], null],
    updatePassword: async () => null,
    updateUserProfile: async () => null,
    updateUserAvatar: async () => null,
    deactiveUser: async () => null,
    restoreUser: async () => null,
    loadProfile: async () => [null, null]
}
const authUseCase = { signOut: async () => null }

const Host = defineComponent({
    setup() {
        provide(SETTINGS_VIEW_CONTEXT_KEY, {
            authUseCase,
            userUseCase,
            subscriber: {},
            dialogManager: {
                open: () => {},
                close: () => {},
                // 注销/撤销注销弹层在 mounted 里向 dialogManager 登记自身
                register: () => {},
                unregister: () => {}
            },
            isDisplayAside: ref(false),
            isUseFloatAside: ref(false),
            switchDisplayAside: () => {}
        })
        return () =>
            h('div', { class: 'sd-panel', style: 'padding: var(--nue-padding-df)' }, [
                h(AccountPanel)
            ])
    }
})

const app = createApp(Host)
const pinia = createPinia()
const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }]
})
app.use(pinia).use(router).use(i18n).use(nueUI)

useUserStore(pinia).setUserProfile({
    nickname: '张三',
    email: 'zhangsan@example.com',
    createdAt: '2026-01-02 03:04:05'
})

app.mount('#app')
${PAGE_SCRIPT}
`

interface SectionMeasure {
    viewport: { width: number; height: number }
    panel: { clientHeight: number; clientWidth: number }
    heads: Array<{
        id: string
        title: string
        desc: string
        titleLeft: number | null
        descLeft: number | null
        fontSize: number
        fontWeight: string
    }>
    passwordBlock: {
        rect: { left: number; right: number; width: number; height: number }
        backgroundColor: string
        padding: [string, string, string, string]
        borderRadius: string
        borderTopWidth: number
        boxShadow: string
    } | null
    passwordForm: { left: number; right: number; width: number; height: number } | null
    passwordAncestors: Array<{
        className: string
        isBlock: boolean
        backgroundColor: string
        padding: [string, string, string, string]
        borderRadius: string
    }>
    passwordLabel: { color: string; left: number } | null
    labelToken: string
    primary700Color: string
    primary600Color: string
    profileContent: { left: number; right: number; width: number; height: number } | null
    sessionsBlock: { left: number; right: number; width: number; height: number } | null
    tokens: { textLg: number; paddingSm: number; paddingDf: number }
    sessionTitles: { byClass: number; exactText: number }
}

interface RenderResult {
    wide: SectionMeasure
    narrow: SectionMeasure
    /** 对照：加回旧版 12px 块内边距后的几何（验证「右移 12 / 窄屏少 24」的判据有牙） */
    oldPadding: {
        wide: {
            before: { form: { left: number; width: number } | null }
            after: { form: { left: number; width: number } | null }
        }
        narrow: {
            before: {
                form: { left: number; width: number } | null
                block: { width: number } | null
            }
            after: { form: { left: number; width: number } | null; block: { width: number } | null }
        }
    }
    logs: string[]
}

/** 子进程里跑的 CDP 编排（Node 自带 WebSocket；产物 = 一行 `__RESULT__{json}`） */
const PROBE_SCRIPT = String.raw`
import { spawn } from 'node:child_process'

const [pagePath, chromium] = process.argv.slice(2)
const dir = new URL('.', import.meta.url).pathname
const browser = spawn(
  chromium,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--allow-file-access-from-files',
    '--remote-debugging-port=0',
    '--user-data-dir=' + dir + 'profile-' + Date.now(),
    '--window-size=1200,900',
    'about:blank'
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] }
)

const wsUrl = await new Promise((resolve, reject) => {
  let buffer = ''
  const timer = setTimeout(() => reject(new Error('Chromium 启动超时（60s）')), 60000)
  browser.stderr.on('data', (chunk) => {
    buffer += chunk.toString()
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/)
    if (match) {
      clearTimeout(timer)
      resolve(match[1])
    }
  })
  browser.on('exit', (code) => {
    clearTimeout(timer)
    reject(new Error('Chromium 提前退出 code=' + code))
  })
})

const socket = new WebSocket(wsUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', () => reject(new Error('CDP 连接失败')), { once: true })
})
const pending = new Map()
const logs = []
let nextId = 1
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (typeof message.id === 'number') {
    const handler = pending.get(message.id)
    if (handler) {
      pending.delete(message.id)
      handler(message)
    }
    return
  }
  if (message.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION: ' + JSON.stringify(message.params.exceptionDetails || {}).slice(0, 400))
  }
})
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, (message) => {
      if (message.error) reject(new Error(method + ': ' + (message.error.message || '未知错误')))
      else resolve(message.result || {})
    })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let output = null
try {
  const { targetId } = await send('Target.createTarget', { url: 'file://' + pagePath })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  await send('Runtime.enable', {}, sessionId)
  // ⛔ 不靠「新 target 恰好拿到布局视口」这种运气（CI 上会静默变 0×0）
  await send('Page.bringToFront', {}, sessionId)

  let viewport = { width: 1200, height: 900 }
  const setViewport = async (width, height) => {
    viewport = { width, height }
    await send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false },
      sessionId
    )
    await pause(250)
  }
  await setViewport(1200, 900)

  const evaluate = async (expression) => {
    const result = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId
    )
    if (result.exceptionDetails) {
      throw new Error('页面脚本异常：' + JSON.stringify(result.exceptionDetails).slice(0, 500))
    }
    return result.result ? result.result.value : undefined
  }

  let ready = false
  for (let attempt = 0; attempt < 150; attempt++) {
    if ((await evaluate('window.__qaIsReady === true')) === true) {
      ready = true
      break
    }
    await pause(100)
  }
  if (!ready) throw new Error('账户面板未渲染出可布局的几何（logs: ' + logs.join(' | ').slice(0, 800) + '）')

  const wide = await evaluate('window.__qa.measure()')
  const oldPaddingWide = await evaluate('window.__qa.withOldPadding()')

  // 窄屏（<=445 断点外的 390px 移动视口）：量「块宽 = 容器内容宽」与「加回旧内边距后少 24」
  await setViewport(390, 844)
  const narrow = await evaluate('window.__qa.measure()')
  const oldPaddingNarrow = await evaluate('window.__qa.withOldPadding()')

  output = {
    wide,
    narrow,
    oldPadding: { wide: oldPaddingWide, narrow: oldPaddingNarrow },
    logs: logs.slice(0, 20)
  }
} finally {
  socket.close()
  browser.kill('SIGKILL')
}

process.stdout.write('__RESULT__' + JSON.stringify(output))
process.exit(0)
`

/** 跑一次渲染探针；进程级失败自动重试（只重试「起不来 / 连不上」类环境失败） */
const runProbeOnce = (indexPath: string): Promise<RenderResult> => {
    const scriptPath = join(PROBE_DIR, 'probe.mjs')
    writeFileSync(scriptPath, PROBE_SCRIPT, 'utf8')

    return new Promise<RenderResult>((resolvePromise, reject) => {
        const child = spawn(process.execPath, [scriptPath, indexPath, EXECUTABLE], {
            stdio: ['ignore', 'pipe', 'pipe']
        })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString()
        })
        child.on('exit', (code) => {
            const match = stdout.match(/__RESULT__(.+)$/s)
            if (code === 0 && match) {
                resolvePromise(JSON.parse(match[1]!) as RenderResult)
                return
            }
            reject(
                new Error(
                    `渲染探针失败（code=${code}）\n--- stderr ---\n${stderr.slice(-2000)}\n--- stdout ---\n${stdout.slice(-1500)}`
                )
            )
        })
    })
}

const runProbe = async (indexPath: string, attempts = 3): Promise<RenderResult> => {
    const failures: string[] = []
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await runProbeOnce(indexPath)
        } catch (error) {
            failures.push(`#${attempt}: ${(error as Error).message.split('\n')[0]}`)
            if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1500))
        }
    }
    throw new Error(`渲染探针连续 ${attempts} 次失败：\n${failures.join('\n')}`)
}

/** 生产同一份 `.sd-*` 样式（⛔ 不在夹具里重写任何规则） */
const dialogStyleText = (): string => {
    const source = readFileSync(join(WEB_SRC, 'components/settings/dialog/index.vue'), 'utf8')
    const start = source.indexOf('<style>')
    const end = source.lastIndexOf('</style>')
    return source.slice(start + '<style>'.length, end)
}

describeRender('T752 / 账户四分区 + 密码分区去底色 · 渲染后实测（headless Chromium）', () => {
    let result: RenderResult | null = null

    beforeAll(() => {
        rmSync(PROBE_DIR, { recursive: true, force: true })
        mkdirSync(PROBE_DIR, { recursive: true })
        symlinkSync(join(REPO, 'node_modules'), join(PROBE_DIR, 'node_modules'), 'dir')
    })

    afterAll(() => {
        // 排障用：`T752_KEEP=1` 保留产物（目录本就在仓库外，残留也不污染工作区）
        if (!process.env.T752_KEEP) rmSync(PROBE_DIR, { recursive: true, force: true })
    })

    const probe = async (): Promise<RenderResult> => {
        if (result) return result
        writeFileSync(join(PROBE_DIR, 'settings.css'), dialogStyleText(), 'utf8')
        writeFileSync(join(PROBE_DIR, 'main.ts'), mainTs(), 'utf8')
        writeFileSync(
            join(PROBE_DIR, 'index.html'),
            `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>T752 账户四分区渲染探针</title>
<style>
/* 只停掉入场动画（几何测量不看淡入）；⛔ 不改任何布局 / 颜色规则 */
.sd-cat{animation:none!important}
</style></head><body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>`,
            'utf8'
        )
        await build({
            root: PROBE_DIR,
            configFile: false,
            logLevel: 'error',
            base: './',
            plugins: [vue()],
            resolve: {
                alias: [{ find: /^@\//, replacement: `${WEB_SRC}/` }],
                dedupe: ['vue', 'pinia', 'vue-router', 'vue-i18n', 'nue-ui']
            },
            build: {
                outDir: join(PROBE_DIR, 'dist'),
                emptyOutDir: true,
                modulePreload: false,
                minify: false
            }
        })
        result = await runProbe(join(PROBE_DIR, 'dist/index.html'))
        writeFileSync(join(tmpdir(), 't752-sections-probe.json'), JSON.stringify(result, null, 4))
        return result
    }

    it(
        '四分区组头齐备（20/600）· 组头 / 密码表单 / 相邻行**同一条左轴线**',
        async () => {
            const measured = await probe()
            expect(
                measured.logs.filter((line) => line.startsWith('EXCEPTION')),
                '页面不得有异常'
            ).toEqual([])

            // 窗口活着（无布局视口 ⇒ clientHeight 恒 0，几何会静默假成立）
            expect(measured.wide.panel.clientHeight, '账户面板必须有真实布局高度').toBeGreaterThan(
                0
            )

            expect(measured.wide.heads.map((head) => head.id)).toEqual([
                'profile',
                'password',
                'devices',
                'danger'
            ])
            expect(measured.wide.heads.map((head) => head.title)).toEqual([
                '用户信息',
                '密码修改',
                '登录设备',
                '危险区域'
            ])
            // 每区都有副标题
            for (const head of measured.wide.heads) {
                expect(head.desc.length, `${head.id} 缺副标题`).toBeGreaterThan(0)
            }
            // 组头 = 20 / 600（token 实测，⛔ 不硬编码 rem→px 换算）
            for (const head of measured.wide.heads) {
                expect(head.fontSize, `${head.id} 组头字号`).toBe(measured.wide.tokens.textLg)
                expect(head.fontWeight, `${head.id} 组头字重`).toBe('600')
            }

            // ① 四个分区组头左缘一致
            const headLefts = measured.wide.heads.map((head) => head.titleLeft!)
            expect(
                Math.max(...headLefts) - Math.min(...headLefts),
                '组头左缘必须同线'
            ).toBeLessThanOrEqual(0.5)
            // ② 密码表单左缘 = 相邻行（资料身份区 / 登录设备块）左缘 = 组头左缘（≤0.5px）
            const formLeft = measured.wide.passwordForm!.left
            const refs = [
                measured.wide.profileContent!.left,
                measured.wide.sessionsBlock!.left,
                measured.wide.heads[1]!.titleLeft!
            ]
            for (const ref of refs) {
                expect(
                    Math.abs(formLeft - ref),
                    `密码表单左缘 ${formLeft} 与相邻行左缘 ${ref} 不同线`
                ).toBeLessThanOrEqual(0.5)
            }
            // 对照：把旧版 12px 块内边距加回去 ⇒ 右移 12（证明上一条判据有牙）
            const paddedForm = measured.oldPadding.wide.after.form!
            expect(
                Math.abs(paddedForm.left - formLeft),
                '旧版内边距应使密码表单右移 ≈12'
            ).toBeGreaterThan(11.5)
        },
        PROBE_TIMEOUT
    )

    it(
        '密码分区**无底色 / 无内边距 / 无圆角**（计算样式）+ label 不覆写 -700',
        async () => {
            const measured = await probe()
            const block = measured.wide.passwordBlock!
            expect(block.backgroundColor, '密码分区不得有底色').toMatch(
                /^(rgba\(0, 0, 0, 0\)|transparent)$/
            )
            expect(block.borderRadius, '密码分区不得有圆角').toBe('0px')
            for (const side of block.padding) {
                expect(Number.parseFloat(side), '密码分区不得有内边距').toBe(0)
            }
            // ⛔ 也不许改用第三种区分手段（描边 / 阴影）
            expect(block.borderTopWidth, '不得用描边区分').toBe(0)
            expect(block.boxShadow, '不得用阴影区分').toBe('none')

            // 表单到内容块之间**没有任何一层**带底色 / 内边距 / 圆角
            // （只查块本身不够：旧三件套换个类名套在中间层就能绕过）
            expect(measured.wide.passwordAncestors.length, '必须能走到内容块').toBeGreaterThan(0)
            expect(
                measured.wide.passwordAncestors.some((layer) => layer.isBlock),
                '祖先链必须终止于 [data-setting-id="password"]'
            ).toBe(true)
            for (const layer of measured.wide.passwordAncestors) {
                expect(layer.backgroundColor, `${layer.className} 不得有底色`).toMatch(
                    /^(rgba\(0, 0, 0, 0\)|transparent)$/
                )
                expect(layer.borderRadius, `${layer.className} 不得有圆角`).toBe('0px')
                for (const side of layer.padding) {
                    expect(Number.parseFloat(side), `${layer.className} 不得有内边距`).toBe(0)
                }
            }
            // label 回 `-600`（不再为压浅底而覆写 `-700`）
            expect(measured.wide.passwordLabel, '密码表单 label 必须存在').not.toBeNull()
            expect(measured.wide.passwordLabel!.color, '密码 label 必须为 -600').toBe(
                measured.wide.primary600Color
            )
            expect(measured.wide.passwordLabel!.color, 'label 不得再被覆写为 -700').not.toBe(
                measured.wide.primary700Color
            )
        },
        PROBE_TIMEOUT
    )

    it(
        '窄屏（390px）可用宽 +24：密码块宽 = 容器内容宽（旧版内边距会少 24）',
        async () => {
            const measured = await probe()
            const narrow = measured.narrow
            expect(narrow.viewport.width).toBe(390)
            expect(narrow.panel.clientHeight, '窄屏窗口必须活着').toBeGreaterThan(0)

            // 块宽 = 组内容宽（`.sd-group` 的 padding-inline 是唯一内缩来源）
            const blockWidth = narrow.passwordBlock!.rect.width
            const formWidth = narrow.passwordForm!.width
            expect(formWidth, '密码表单不得溢出容器').toBeLessThanOrEqual(blockWidth + 0.5)
            expect(
                Math.abs(blockWidth - formWidth),
                '表单与块同宽（无第二层内边距）'
            ).toBeLessThanOrEqual(0.5)

            // 对照：加回旧版 12px 左右内边距 ⇒ 表单可用宽恰好少 24
            const beforeWidth = measured.oldPadding.narrow.before.form!.width
            const afterWidth = measured.oldPadding.narrow.after.form!.width
            const delta = Math.round((beforeWidth - afterWidth) * 100) / 100
            expect(delta, `窄屏可用宽差必须 = 24（实测 ${delta}）`).toBe(24)

            // 窄屏左缘同样同线（不因宽度变化而漂移）
            const narrowFormLeft = narrow.passwordForm!.left
            expect(
                Math.abs(narrowFormLeft - narrow.heads[1]!.titleLeft!),
                '窄屏下密码表单与组头不同线'
            ).toBeLessThanOrEqual(0.5)
        },
        PROBE_TIMEOUT
    )

    it(
        '登录设备：组件内同名小标题不再出现（标题只由分区组头承担）',
        async () => {
            const measured = await probe()
            expect(
                measured.wide.sessionTitles.byClass,
                '`.session-manager__title` 必须已移除'
            ).toBe(0)
            expect(
                measured.wide.sessionTitles.exactText,
                '「登录设备」作为独立标题只出现一次'
            ).toBe(1)
            // 副标题键必须落在分区组头上（不是组件内残留文案）
            expect(measured.wide.heads[2]!.desc).toBe('已登录的浏览器与设备，可单独下线')
        },
        PROBE_TIMEOUT
    )
})