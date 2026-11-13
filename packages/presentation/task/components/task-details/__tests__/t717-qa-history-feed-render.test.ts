// @vitest-environment node
import { execSync, spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import { build } from 'vite-plus'
import vue from '@vitejs/plugin-vue'

/**
 * `T717` · 活动流的**渲染后实测**（真 Vite 构建 + 真 Vue 运行时 + 真主题 + headless Chromium）
 *
 * 为什么必须真浏览器：`jsdom` **无布局引擎** —— `getBoundingClientRect()` 恒 0、
 * `scrollWidth == clientWidth`、不加载 SFC 样式、不算 CSS 变量 ⇒ 「行高 ≥44px」「省略号真溢出」
 * 「渲染后对比度」「真 hover / 真焦点环」「真按 Enter」**只能**在真浏览器里量。
 * 本文件的做法：把**真组件**（`task-history-dialog.vue`，未改动）用 Vite 打成一个小页面，
 * Chromium 加载后：
 * ① `getComputedStyle` / `getBoundingClientRect` 实测几何与颜色；
 * ② CDP `Input.dispatchMouseEvent` 造**真 hover**、`dispatchKeyEvent` 造**真 Tab / Enter**；
 * ③ 浅 / 深两主题各量一遍（`--nue-dark-switch` 0/1，与 `theme-store` 同一开关）；
 * ④ 对比度在**取到的渲染色**上用 WCAG 公式算（⛔ 不采信任何自测表）。
 *
 * 缺 Chromium 的环境（CI）⇒ **skip**（不是失败）；本机有则必跑。
 * 结果同时落 `$TMPDIR/t717-render-probe.json` 供报告引用。
 * @see docs/prds/2026-11-10-audit-log.md（AC13：对比度「按渲染后计算样式实测」）
 */

const REPO = resolve(import.meta.dirname, '../../../../../..')
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

/** Vite 构建 + Chromium 起停 + 多步交互 ⇒ 单例给 120s（CI 无 Chromium 时整体 skip） */
const PROBE_TIMEOUT = 120_000

const DAY = 86_400_000

const LONG_VALUE =
    '这是一段非常长的描述文本，用来验证活动流主文案在单行内省略号生效、全文仍可从 title 读到，并且展开后能看到完整内容，而不是被截断成一句看不懂的半截话，长度需要超过对话框宽度的一整行甚至更多才行。'

const ITEMS = [
    {
        seq: 4,
        at: 'TODAY_A',
        source: 'local-edit',
        action: 'update',
        fields: [
            { field: 'description', from: '旧描述', to: LONG_VALUE },
            { field: 'priority', from: 'medium', to: 'high' }
        ]
    },
    {
        seq: 3,
        at: 'TODAY_B',
        source: 'pull',
        action: 'update',
        fields: [{ field: 'name', from: '旧名', to: '新名' }]
    },
    {
        seq: 2,
        at: 'YESTERDAY',
        source: 'push-merge',
        action: 'update',
        fields: [{ field: 'state', from: 'todo', to: 'done' }]
    },
    {
        seq: 1,
        at: 'EARLIER',
        source: 'conflict-retry',
        action: 'create',
        fields: [{ field: 'name', from: null, to: '买菜' }]
    }
]

const PROBE_DIR = join(REPO, '.t717-render-probe')

const PAGE_SCRIPT = String.raw`
window.__events = []
document.addEventListener('keydown', (e) => window.__events.push('kd:' + e.key), true)
document.addEventListener('click', (e) => window.__events.push('click:' + ((e.target && (e.target.className || e.target.tagName)) || '?')), true)
window.__qa = (() => {
  const px = (value) => Number.parseFloat(value) || 0
  const parseColor = (value) => {
    const match = String(value).match(/rgba?\(([^)]+)\)/)
    if (!match) return null
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }
  const opaqueBackdrop = (el) => {
    let node = el
    while (node && node.nodeType === 1) {
      const color = getComputedStyle(node).backgroundColor
      const parsed = parseColor(color)
      if (parsed && parsed.a > 0) return color
      node = node.parentElement
    }
    return 'rgb(255, 255, 255)'
  }
  const token = (name) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(' + name + ')'
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).backgroundColor
    probe.remove()
    return value
  }
  const rows = () => Array.from(document.querySelectorAll('button.task-history__entry'))
  const measure = () => {
    const view = rows().map((row) => {
      const badge = row.querySelector('.task-history__badge')
      const summary = row.querySelector('.task-history__summary')
      const time = row.querySelector('time')
      const toggle = row.querySelector('.task-history__toggle')
      const rowStyle = getComputedStyle(row)
      const badgeStyle = badge ? getComputedStyle(badge) : null
      const summaryStyle = summary ? getComputedStyle(summary) : null
      const beforeStyle = getComputedStyle(row, '::before')
      const afterStyle = getComputedStyle(row, '::after')
      const rect = row.getBoundingClientRect()
      return {
        symbol: (badge ? badge.textContent : '').trim(),
        expanded: row.getAttribute('aria-expanded'),
        height: Math.round(rect.height * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        borderLeftWidth: px(rowStyle.borderLeftWidth),
        borderLeftStyle: rowStyle.borderLeftStyle,
        borderTopWidth: px(rowStyle.borderTopWidth),
        boxShadow: rowStyle.boxShadow,
        rowBackground: rowStyle.backgroundColor,
        backdrop: opaqueBackdrop(row),
        textColor: summaryStyle ? summaryStyle.color : rowStyle.color,
        before: { content: beforeStyle.content, borderLeftWidth: px(beforeStyle.borderLeftWidth), width: px(beforeStyle.width) },
        after: { content: afterStyle.content, borderLeftWidth: px(afterStyle.borderLeftWidth), width: px(afterStyle.width) },
        badge: badgeStyle
          ? {
              width: Math.round(badge.getBoundingClientRect().width * 100) / 100,
              height: Math.round(badge.getBoundingClientRect().height * 100) / 100,
              radius: badgeStyle.borderRadius,
              background: badgeStyle.backgroundColor,
              color: badgeStyle.color
            }
          : null,
        summary: summaryStyle
          ? {
              fontSize: summaryStyle.fontSize,
              scrollWidth: summary.scrollWidth,
              clientWidth: summary.clientWidth,
              textOverflow: summaryStyle.textOverflow,
              whiteSpace: summaryStyle.whiteSpace,
              overflow: summaryStyle.overflow
            }
          : null,
        time: time
          ? {
              color: getComputedStyle(time).color,
              fontSize: getComputedStyle(time).fontSize,
              fontVariantNumeric: getComputedStyle(time).fontVariantNumeric
            }
          : null,
        toggle: toggle
          ? { text: (toggle.textContent || '').trim(), color: getComputedStyle(toggle).color }
          : null
      }
    })
    const groupTitle = document.querySelector('.task-history__group-title')
    const list = document.querySelector('.task-history__list')
    const more = document.querySelector('.task-history__more')
    const detail = document.querySelector('.task-history__detail')
    const dialog = document.querySelector('.nue-dialog--task-history')
    return {
      rows: view,
      tokens: {
        hoverBackground: token('--nue-primary-color-100'),
        focusRing: token('--nue-primary-color-700'),
        dialogBackground: token('--nue-primary-color-0')
      },
      groupTitle: groupTitle
        ? {
            text: (groupTitle.textContent || '').trim(),
            color: getComputedStyle(groupTitle).color,
            fontSize: getComputedStyle(groupTitle).fontSize,
            backdrop: opaqueBackdrop(groupTitle)
          }
        : null,
      list: list
        ? {
            maxHeight: getComputedStyle(list).maxHeight,
            height: Math.round(list.getBoundingClientRect().height * 100) / 100,
            scrollHeight: list.scrollHeight,
            clientHeight: list.clientHeight
          }
        : null,
      detail: detail
        ? {
            color: getComputedStyle(detail).color,
            backdrop: opaqueBackdrop(detail),
            text: (detail.textContent || '').trim().slice(0, 40),
            rowHeight: Math.round(detail.closest('button').getBoundingClientRect().height * 100) / 100
          }
        : null,
      more: more
        ? {
            text: (more.textContent || '').trim(),
            borderTopWidth: px(getComputedStyle(more).borderTopWidth),
            borderLeftWidth: px(getComputedStyle(more).borderLeftWidth),
            borderStyle: getComputedStyle(more).borderTopStyle,
            borderColor: getComputedStyle(more).borderTopColor,
            borderRadius: getComputedStyle(more).borderRadius,
            background: getComputedStyle(more).backgroundColor,
            height: Math.round(more.getBoundingClientRect().height * 100) / 100
          }
        : null,
      dialog: dialog ? { width: Math.round(dialog.getBoundingClientRect().width * 100) / 100 } : null
    }
  }
  return {
    measure,
    rowCenter: (index) => {
      const rect = rows()[index].getBoundingClientRect()
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
    },
    rowBackground: (index) => {
      const list = rows()
      const el = list[index]
      return el
        ? getComputedStyle(el).backgroundColor
        : 'NO_ROW(count=' + list.length + ',html=' + document.querySelectorAll('.nue-dialog--task-history').length + ')'
    },
    rowCount: () => rows().length,
    focusInfo: () => {
      const active = document.activeElement
      const style = getComputedStyle(active)
      return {
        activeTag: active ? active.tagName + '.' + (Array.from(active.classList).join('.') || '-') : 'none',
        isRow: active ? active.matches('button.task-history__entry') : false,
        focusVisible: active ? active.matches(':focus-visible') : false,
        outlineWidth: px(style.outlineWidth),
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        background: style.backgroundColor
      }
    },
    rowState: (index) => {
      const row = rows()[index]
      const summary = row.querySelector('.task-history__summary')
      const summaryStyle = getComputedStyle(summary)
      return {
        expanded: row.getAttribute('aria-expanded'),
        detailRows: row.querySelectorAll('.task-history__detail-row').length,
        detailText: (row.querySelector('.task-history__detail') || {}).textContent || '',
        summary: {
          scrollWidth: summary.scrollWidth,
          clientWidth: summary.clientWidth,
          whiteSpace: summaryStyle.whiteSpace,
          overflow: summaryStyle.overflow
        },
        height: Math.round(row.getBoundingClientRect().height * 100) / 100
      }
    },
    events: () => window.__events.slice(-12),
    focusRow: (index) => {
      if (!rows()[index]) return false
      rows()[index].focus()
      return document.activeElement === rows()[index]
    },
    blur: () => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur()
      return true
    },
    clickRow: (index) => {
      rows()[index].click()
      return true
    },
    setDark: () => {
      document.documentElement.style.setProperty('--nue-dark-switch', '1')
      return true
    }
  }
})()
true
`

/** main.ts：真组件 + 固定页数据 + 测量助手（页面里的 Vue 是**真运行时**，交互才真的是交互） */
const mainTs = (): string => {
    const items = ITEMS.map((item) => ({
        ...item,
        at:
            item.at === 'TODAY_A'
                ? new Date().toISOString()
                : item.at === 'TODAY_B'
                  ? new Date(Date.now() - 60_000).toISOString()
                  : item.at === 'YESTERDAY'
                    ? new Date(Date.now() - DAY).toISOString()
                    : new Date(Date.now() - 3 * DAY).toISOString()
    }))
    return `import { createApp, defineComponent, h, provide, ref } from 'vue'
import { NueButton, NueDialog, NueDiv, NueEmpty, NueIcon, NueText } from 'nue-ui'
import 'nue-ui-theme-shadlike/dist/index.css'
import TaskHistoryDialog from '${join(REPO, 'packages/presentation/task/components/task-details/task-history-dialog.vue')}'
import { TASK_HISTORY_CONTEXT_KEY } from '${join(REPO, 'packages/presentation/task/components/task-details/context')}'

const PAGE = {
    items: ${JSON.stringify(items)},
    hasMore: true,
    unavailable: false
}

const load = async () => PAGE

const visible = ref(false)
const Host = defineComponent({
    setup() {
        provide(TASK_HISTORY_CONTEXT_KEY, { load })
        return () =>
            h(TaskHistoryDialog, {
                modelValue: visible.value,
                'onUpdate:modelValue': (value) => {
                    visible.value = Boolean(value)
                },
                taskId: 'task-t717'
            })
    }
})

const app = createApp(Host)
for (const [name, component] of Object.entries({
    'nue-button': NueButton,
    'nue-dialog': NueDialog,
    'nue-div': NueDiv,
    'nue-empty': NueEmpty,
    'nue-icon': NueIcon,
    'nue-text': NueText
})) {
    app.component(name, component)
}
app.mount('#app')
// 与真实用法一致（NueDialog 的 modelValue watcher 非 immediate）：先关再开
visible.value = true

const raf = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
const ready = async () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        await raf()
        if (document.querySelectorAll('button.task-history__entry').length >= 4) {
            // 入场动画会改 transform ⇒ 等它走完（240ms）再量，坐标才稳定
            await new Promise((resolve) => setTimeout(resolve, 500))
            return true
        }
    }
    return false
}
window.__qaReady = ready()
${PAGE_SCRIPT}
`
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
  const timer = setTimeout(() => reject(new Error('Chromium 启动超时')), 30000)
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
  if (message.method === 'Runtime.consoleAPICalled') {
    logs.push((message.params.args || []).map((arg) => String(arg.value ?? arg.description ?? '')).join(' '))
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
const enter = async (sessionId) => {
  await send(
    'Input.dispatchKeyEvent',
    { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' },
    sessionId
  )
  await send(
    'Input.dispatchKeyEvent',
    { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 },
    sessionId
  )
}
const tab = async (sessionId) => {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId)
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, sessionId)
}

let output = null
try {
  const { targetId } = await send('Target.createTarget', { url: 'file://' + pagePath })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  await send('Runtime.enable', {}, sessionId)

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
    const value = await evaluate('typeof window.__qaReady === "undefined" ? null : window.__qaReady')
    if (value === true) {
      ready = true
      break
    }
    await pause(100)
  }
  if (!ready) throw new Error('页面未渲染出 4 条活动流记录（logs: ' + logs.join(' | ').slice(0, 800) + '）')

  await evaluate('window.__qa.blur()')
  await pause(150)
  const light = await evaluate('window.__qa.measure()')

  const center = await evaluate('window.__qa.rowCenter(1)')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: center.x, y: center.y, button: 'none' }, sessionId)
  await pause(300)
  const hoverBackground = await evaluate('window.__qa.rowBackground(1)')
  const hoveredSummary = await evaluate('window.__qa.measure()')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2, button: 'none' }, sessionId)
  await pause(200)

  // 真键盘：Tab 直到焦点落在行上（前面还有 × / 底部按钮）
  let focus = null
  for (let attempt = 0; attempt < 20; attempt++) {
    await tab(sessionId)
    await pause(80)
    focus = await evaluate('window.__qa.focusInfo()')
    if (focus.isRow) break
  }
  await evaluate('window.__qa.blur()')
  await pause(150)

  // 真 Enter：展开 / 收起（键盘路径）
  await evaluate('window.__qa.focusRow(0)')
  await pause(150)
  const before = await evaluate('window.__qa.rowState(0)')
  await enter(sessionId)
  await pause(350)
  const afterEnter = await evaluate('window.__qa.rowState(0)')
  await enter(sessionId)
  await pause(350)
  const afterSecond = await evaluate('window.__qa.rowState(0)')
  await evaluate('window.__qa.blur()')
  await pause(150)

  // 展开态（点击展开，用于量「差异文字」颜色与行高）——与 Enter 路径分开，避免焦点底色污染底色
  await evaluate('window.__qa.clickRow(0)')
  await pause(300)
  const expanded = await evaluate('window.__qa.measure()')
  await evaluate('window.__qa.clickRow(0)')
  await pause(250)

  await evaluate('window.__qa.setDark()')
  await pause(350)
  const dark = await evaluate('window.__qa.measure()')
  await evaluate('window.__qa.clickRow(0)')
  await pause(300)
  const darkExpanded = await evaluate('window.__qa.measure()')
  await evaluate('window.__qa.clickRow(0)')
  await pause(200)

  output = {
    light,
    dark,
    expanded,
    darkExpanded,
    hoveredSummary,
    hover: {
      background: hoverBackground,
      changed: hoverBackground !== light.rows[1].rowBackground,
      expected: light.tokens.hoverBackground
    },
    focus,
    keyboard: {
      before: before.expanded,
      afterEnter: afterEnter.expanded,
      afterSecondEnter: afterSecond.expanded,
      detailRows: afterEnter.detailRows,
      detailText: afterEnter.detailText.slice(0, 40),
      expandedHeight: afterEnter.height
    },
    collapsedSummary: before.summary,
    expandedSummary: afterEnter.summary,
    logs: logs.slice(0, 20)
  }
} finally {
  socket.close()
  browser.kill('SIGKILL')
}

process.stdout.write('__RESULT__' + JSON.stringify(output))
process.exit(0)
`

interface RenderRow {
    symbol: string
    expanded: string | null
    height: number
    width: number
    borderLeftWidth: number
    borderLeftStyle: string
    borderTopWidth: number
    boxShadow: string
    rowBackground: string
    backdrop: string
    textColor: string
    before: { content: string; borderLeftWidth: number; width: number }
    after: { content: string; borderLeftWidth: number; width: number }
    badge: {
        width: number
        height: number
        radius: string
        background: string
        color: string
    } | null
    summary: {
        fontSize: string
        scrollWidth: number
        clientWidth: number
        textOverflow: string
        whiteSpace: string
        overflow: string
    } | null
    time: { color: string; fontSize: string; fontVariantNumeric: string } | null
    toggle: { text: string; color: string } | null
}

interface RenderMeasure {
    rows: RenderRow[]
    tokens: { hoverBackground: string; focusRing: string; dialogBackground: string }
    groupTitle: { text: string; color: string; fontSize: string; backdrop: string } | null
    list: { maxHeight: string; height: number; scrollHeight: number; clientHeight: number } | null
    detail: { color: string; backdrop: string; text: string; rowHeight: number } | null
    more: {
        text: string
        borderTopWidth: number
        borderLeftWidth: number
        borderStyle: string
        borderColor: string
        borderRadius: string
        background: string
        height: number
    } | null
    dialog: { width: number } | null
}

interface RenderResult {
    light: RenderMeasure
    dark: RenderMeasure
    expanded: RenderMeasure
    darkExpanded: RenderMeasure
    hoveredSummary: RenderMeasure
    hover: { background: string; changed: boolean; expected: string }
    focus: {
        activeTag: string
        isRow: boolean
        focusVisible: boolean
        outlineWidth: number
        outlineColor: string
        outlineStyle: string
        background: string
    }
    keyboard: {
        before: string | null
        afterEnter: string | null
        afterSecondEnter: string | null
        detailRows: number
        detailText: string
        expandedHeight: number
    }
    collapsedSummary: {
        scrollWidth: number
        clientWidth: number
        whiteSpace: string
        overflow: string
    }
    expandedSummary: {
        scrollWidth: number
        clientWidth: number
        whiteSpace: string
        overflow: string
    }
    logs: string[]
}

const runRenderProbe = (indexPath: string): Promise<RenderResult> => {
    const scriptPath = join(PROBE_DIR, 'probe.mjs')
    writeFileSync(scriptPath, PROBE_SCRIPT, 'utf8')

    return new Promise<RenderResult>((resolve, reject) => {
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
                resolve(JSON.parse(match[1]!) as RenderResult)
                return
            }
            reject(
                new Error(
                    `渲染探针失败（code=${code}）\n--- stderr ---\n${stderr.slice(-2500)}\n--- stdout ---\n${stdout.slice(-1500)}`
                )
            )
        })
    })
}

/** `rgb()/rgba()` → 相对亮度（WCAG 2.x） */
const luminance = (color: string): number => {
    const match = color.match(/rgba?\(([^)]+)\)/)!
    const [r, g, b] = match[1]!
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number) as [number, number, number]
    const channel = (value: number): number => {
        const unit = value / 255
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (foreground: string, background: string): number => {
    const a = luminance(foreground)
    const b = luminance(background)
    const [high, low] = a > b ? [a, b] : [b, a]
    return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100
}

/** 灰度（去色）后的亮度 0–255 —— 用来看「颜色通道去掉以后还剩多少差异」 */
const grayOf = (color: string): number => {
    const match = color.match(/rgba?\(([^)]+)\)/)!
    const [r, g, b] = match[1]!
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number) as [number, number, number]
    return Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 10) / 10
}

describeRender('T717 / 活动流渲染后实测（headless Chromium，浅 + 深两主题）', () => {
    let result: RenderResult | null = null

    beforeAll(() => {
        rmSync(PROBE_DIR, { recursive: true, force: true })
        mkdirSync(PROBE_DIR, { recursive: true })
    })

    afterAll(() => {
        // 排障用：`T717_KEEP=1` 保留产物（默认清理）
        if (!process.env.T717_KEEP) rmSync(PROBE_DIR, { recursive: true, force: true })
    })

    const probe = async (): Promise<RenderResult> => {
        if (result) return result
        writeFileSync(join(PROBE_DIR, 'main.ts'), mainTs(), 'utf8')
        writeFileSync(
            join(PROBE_DIR, 'index.html'),
            `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>T717 活动流渲染探针</title>
<style>
/* 探针页只用来看**行内呈现**：入场 / 退场动画与 hover 过渡一律停掉
   （避免 animationend 驱动的开合状态机与过渡抖动影响几何测量；行/徽标/文字样式不受影响） */
.nue-dialog,.nue-overlay,.task-history__entry{animation:none!important;transition:none!important}
</style></head><body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>`,
            'utf8'
        )
        await build({
            root: PROBE_DIR,
            configFile: false,
            logLevel: 'error',
            base: './',
            plugins: [vue()],
            build: {
                outDir: join(PROBE_DIR, 'dist'),
                emptyOutDir: true,
                modulePreload: false,
                minify: false
            }
        })
        result = await runRenderProbe(join(PROBE_DIR, 'dist/index.html'))
        writeFileSync(join(tmpdir(), 't717-render-probe.json'), JSON.stringify(result, null, 4))
        return result
    }

    it(
        '行高 ≥44px · 左边框 / 竖线 0 · 单行省略真溢出（scrollWidth > clientWidth）',
        async () => {
            const measured = await probe()
            expect(
                measured.logs.filter((line) => line.startsWith('EXCEPTION')),
                '页面不得有异常'
            ).toEqual([])

            for (const row of measured.light.rows) {
                expect(row.height, `行高必须 ≥44（实测 ${row.height}）`).toBeGreaterThanOrEqual(44)
                expect(row.borderLeftWidth, '渲染后 border-left 必须为 0').toBe(0)
                expect(row.before.borderLeftWidth, '::before 不得画竖线').toBe(0)
                expect(row.after.borderLeftWidth, '::after 不得画竖线').toBe(0)
                expect(row.boxShadow, '⛔ 不得用 box-shadow 画侧边条').toBe('none')
                expect(row.badge!.width, '徽标 20px').toBe(20)
                expect(row.badge!.height, '徽标 20px').toBe(20)
                expect(row.badge!.radius, '徽标必须是圆形').toContain('50%')
            }

            const longRow = measured.light.rows[0]!
            expect(longRow.summary!.textOverflow).toBe('ellipsis')
            expect(longRow.summary!.whiteSpace).toBe('nowrap')
            expect(
                longRow.summary!.scrollWidth,
                `长值必须真溢出（scrollWidth ${longRow.summary!.scrollWidth} > clientWidth ${longRow.summary!.clientWidth}）`
            ).toBeGreaterThan(longRow.summary!.clientWidth)

            expect(measured.expandedSummary.whiteSpace, '展开后必须真换行').toBe('normal')
            expect(
                measured.expandedSummary.scrollWidth,
                '展开后不得再溢出（不再省略）'
            ).toBeLessThanOrEqual(measured.expandedSummary.clientWidth + 1)
        },
        PROBE_TIMEOUT
    )

    it(
        '真键盘：Tab 聚焦到行（:focus-visible + 可见焦点环）+ Enter 展开 / 再 Enter 收起',
        async () => {
            const measured = await probe()

            expect(measured.focus.isRow, 'Tab 必须能走到活动流行上').toBe(true)
            expect(measured.focus.focusVisible, '键盘聚焦必须命中 :focus-visible').toBe(true)
            expect(measured.focus.outlineWidth, '焦点环必须可见（≥2px）').toBeGreaterThanOrEqual(2)
            expect(measured.focus.outlineStyle).not.toBe('none')

            expect(measured.keyboard.before).toBe('false')
            expect(measured.keyboard.afterEnter, '真按 Enter 必须展开').toBe('true')
            expect(measured.keyboard.detailRows, '展开后逐字段差异').toBeGreaterThanOrEqual(2)
            expect(measured.keyboard.detailText, '展开后的差异文案可读').toContain('旧描述')
            expect(measured.keyboard.afterSecondEnter, '再按 Enter 必须收起').toBe('false')
        },
        PROBE_TIMEOUT
    )

    it(
        '真 hover：整行底色变化，且等于主题 token（⛔ 硬编码色值）',
        async () => {
            const measured = await probe()

            expect(measured.hover.changed, 'hover 必须改变行底色').toBe(true)
            expect(measured.hover.background).toBe(measured.hover.expected)
        },
        PROBE_TIMEOUT
    )

    it(
        '渲染后对比度：文本 ≥4.5 · 图形 ≥3（4 来源 × 浅/深 = 8 组）',
        async () => {
            const measured = await probe()
            const report: string[] = []

            for (const [theme, view] of [
                ['浅色', measured.light],
                ['深色', measured.dark]
            ] as const) {
                const backdrop = view.rows[0]!.backdrop
                const textPairs: Array<[string, string, string]> = [
                    ['主文案', view.rows[0]!.textColor, backdrop],
                    ['右侧时间', view.rows[0]!.time!.color, backdrop],
                    ['展开/收起', view.rows[0]!.toggle!.color, backdrop],
                    ['组标题', view.groupTitle!.color, backdrop],
                    [
                        '差异文字',
                        (theme === '深色' ? measured.darkExpanded : measured.expanded).detail
                            ?.color ?? view.rows[0]!.toggle!.color,
                        backdrop
                    ],
                    ['主文案(hover 底)', view.rows[0]!.textColor, view.tokens.hoverBackground]
                ]
                for (const [name, foreground, background] of textPairs) {
                    const ratio = contrast(foreground, background)
                    report.push(`${theme} ${name}: ${ratio}:1`)
                    expect(
                        ratio,
                        `${theme} ${name} 对比度必须 ≥4.5（实测 ${ratio}:1）`
                    ).toBeGreaterThanOrEqual(4.5)
                }

                for (const row of view.rows) {
                    const ratio = contrast(row.badge!.background, row.backdrop)
                    const symbol = contrast(row.badge!.color, row.badge!.background)
                    report.push(
                        `${theme} 徽标(${row.symbol}) 填色:行底 ${ratio}:1 · 符号:填色 ${symbol}:1`
                    )
                    expect(
                        ratio,
                        `${theme} 徽标(${row.symbol}) vs 行底色 必须 ≥3（实测 ${ratio}:1）`
                    ).toBeGreaterThanOrEqual(3)
                    expect(
                        symbol,
                        `${theme} 徽标符号 必须 ≥4.5（实测 ${symbol}:1）`
                    ).toBeGreaterThanOrEqual(4.5)
                }
                const ring = contrast(view.tokens.focusRing, backdrop)
                report.push(`${theme} 焦点环: 行底 ${ring}:1`)
                expect(ring, `${theme} 焦点环必须 ≥3（实测 ${ring}:1）`).toBeGreaterThanOrEqual(3)
            }

            // eslint-disable-next-line no-console
            console.log(`\n[T717 渲染后对比度]\n${report.join('\n')}\n`)
        },
        PROBE_TIMEOUT
    )

    it(
        '去色可辨：灰度亮度实测 + 符号通道（⛔ 不靠颜色）',
        async () => {
            const measured = await probe()
            const grays = measured.light.rows.map((row) => ({
                symbol: row.symbol,
                gray: grayOf(row.badge!.background)
            }))
            const pairs = grays.flatMap((left, index) =>
                grays
                    .slice(index + 1)
                    .map(
                        (right) =>
                            `${left.symbol}/${right.symbol}=${Math.round(Math.abs(left.gray - right.gray) * 10) / 10}`
                    )
            )
            // eslint-disable-next-line no-console
            console.log(
                `\n[T717 灰度模拟] ${grays.map((item) => `${item.symbol}=${item.gray}`).join(' · ')}\n[T717 灰度两两差] ${pairs.join(' · ')}\n`
            )

            // 颜色通道在灰度下可能塌缩（预期）⇒ 区分必须由符号承担
            expect(
                new Set(measured.light.rows.map((row) => row.symbol)).size,
                '符号四选一必须互异'
            ).toBe(4)
            for (const row of measured.light.rows) {
                const ratio = contrast(row.badge!.color, row.badge!.background)
                expect(ratio, `灰度下符号(${row.symbol}) 仍须 ≥4.5`).toBeGreaterThanOrEqual(4.5)
            }
        },
        PROBE_TIMEOUT
    )
})