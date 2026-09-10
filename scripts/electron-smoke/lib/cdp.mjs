/**
 * 极简 CDP 客户端（Electron / Chromium 通用，零第三方依赖）
 * @description 通过 Chrome DevTools Protocol 驱动真实渲染进程：真实鼠标命中（Input.dispatchMouseEvent）、
 *              真实按键、页面求值、截图、控制台/异常采集、后端封锁（Network.setBlockedURLs）。
 *
 * 关键环境约定（踩坑记录，勿删）：
 * 1. **必须 `Page.bringToFront`**：窗口被完全遮挡/最小化时 Chromium 判定 `visibilityState='hidden'`，
 *    CSS 关闭动画不推进 → 动画结束事件不触发 → 面板/对话框"关不掉"属**假失败**。
 * 2. `Emulation.setFocusEmulationEnabled` 让隐藏态下焦点行为也接近前台（补强，不替代 1）。
 * 3. 需要 Node ≥ 22（内置全局 WebSocket / fetch）。
 */
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { join } from 'node:path'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 常用按键（真实 keydown/keyup，带 key/code/keyCode） */
const KEYS = {
    Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, text: '\t' },
    Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
    Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    n: { key: 'n', code: 'KeyN', windowsVirtualKeyCode: 78, text: 'n' },
    p: { key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80, text: 'p' }
}

/**
 * 连接渲染进程页面目标
 * @param {{ port?: number, urlMatch?: string, timeoutMs?: number }} options
 */
export async function connectRenderer(options = {}) {
    const { port = 9333, urlMatch = 'localhost:5173', timeoutMs = 60000 } = options
    const target = await waitTarget(port, urlMatch, timeoutMs)
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    const pending = new Map()
    const consoleEvents = []
    const requestUrls = []
    /** 响应改写规则（CDP Fetch 域）：[{ urlPattern, status, body, headers? }] */
    let mockRules = []
    let nextId = 0

    ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data)
        if (message.id && pending.has(message.id)) {
            pending.get(message.id)(message)
            pending.delete(message.id)
            return
        }
        if (message.method === 'Network.requestWillBeSent') {
            requestUrls.push(message.params.request.url)
            return
        }
        if (message.method === 'Fetch.requestPaused') {
            void handlePaused(message.params)
            return
        }
        const captured = pickConsoleEvent(message)
        if (captured) consoleEvents.push(captured)
    })
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve)
        ws.addEventListener('error', () => reject(new Error(`CDP 连接失败：${target.url}`)))
    })

    const send = (method, params = {}) =>
        new Promise((resolve) => {
            const id = ++nextId
            pending.set(id, resolve)
            ws.send(JSON.stringify({ id, method, params }))
        })

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Network.enable')
    await send('Log.enable').catch(() => {})

    /** 按规则改写响应（未命中则放行）；用于凭证类失败/服务端错误等场景模拟（不改功能代码） */
    const handlePaused = async (params) => {
        const rule = mockRules.find((item) => matchUrl(params.request.url, item.urlPattern))
        if (!rule) {
            await send('Fetch.continueRequest', { requestId: params.requestId })
            return
        }
        // CORS 头：页面在 5173、API 在 3302（跨源）。
        // 注意：应用端 axios **带凭证**（withCredentials）——此时 `Access-Control-Allow-Origin: *` 会被浏览器拒绝，
        // 必须回显请求 Origin 且带 `Access-Control-Allow-Credentials: true`（否则被误判为"网络错误"）。
        const requestHeaders = params.request.headers ?? {}
        const origin = requestHeaders.Origin ?? requestHeaders.origin ?? '*'
        // 带凭证（withCredentials）时 `*` 对 Allow-Headers/Methods **无效**，必须回显请求声明的头/方法
        const requestedHeaders =
            requestHeaders['Access-Control-Request-Headers'] ??
            requestHeaders['access-control-request-headers'] ??
            'authorization,content-type'
        const requestedMethod =
            requestHeaders['Access-Control-Request-Method'] ??
            requestHeaders['access-control-request-method']
        const isPreflight = String(params.request.method).toUpperCase() === 'OPTIONS'
        const corsHeaders = [
            { name: 'Access-Control-Allow-Origin', value: origin },
            { name: 'Access-Control-Allow-Credentials', value: 'true' },
            { name: 'Access-Control-Allow-Headers', value: requestedHeaders },
            {
                name: 'Access-Control-Allow-Methods',
                value: requestedMethod ?? 'GET,POST,PUT,DELETE,OPTIONS'
            },
            { name: 'Access-Control-Max-Age', value: '0' },
            ...(rule.headers ?? [])
        ]
        await send('Fetch.fulfillRequest', {
            requestId: params.requestId,
            responseCode: isPreflight ? 204 : (rule.status ?? 200),
            responseHeaders: isPreflight
                ? corsHeaders
                : [{ name: 'Content-Type', value: 'application/json' }, ...corsHeaders],
            body: isPreflight ? undefined : Buffer.from(rule.body ?? '').toString('base64')
        })
    }

    const api = {
        send,
        consoleEvents,
        /** 页面求值（自动包 async IIFE，支持 await / return） */
        async evaluate(body) {
            const result = await send('Runtime.evaluate', {
                expression: `(async () => { ${body} })()`,
                awaitPromise: true,
                returnByValue: true,
                userGesture: true
            })
            if (result.result?.exceptionDetails) {
                throw new Error(
                    '页面求值异常：' + JSON.stringify(result.result.exceptionDetails).slice(0, 600)
                )
            }
            return result.result?.result?.value
        },
        /**
         * 页面求值并返回结构化数据（body 必须是**表达式**：对象字面量需加括号，或箭头 IIFE）
         * @example await cdp.json('({ hash: location.hash })')
         * @example await cdp.json('(() => { const r = ...; return r })()')
         */
        async json(body) {
            return api.evaluate(`return (${body})`)
        },
        /** 置前 + 焦点模拟（visibilityState 陷阱的解法，见文件头） */
        async focusPage() {
            await send('Page.bringToFront')
            await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {})
        },
        async visibility() {
            return api.evaluate('return document.visibilityState')
        },
        async screenshot(dir, name) {
            const result = await send('Page.captureScreenshot', { format: 'png' })
            const file = join(dir, `${name}.png`)
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(file, Buffer.from(result.result.data, 'base64'))
            return file
        },
        async mouseMove(x, y) {
            await send('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x,
                y,
                button: 'none',
                buttons: 0
            })
            await sleep(120)
        },
        /** 真实鼠标点击（含 hover → down → up） */
        async click(x, y, settleMs = 600) {
            await api.mouseMove(x, y)
            await send('Input.dispatchMouseEvent', {
                type: 'mousePressed',
                x,
                y,
                button: 'left',
                buttons: 1,
                clickCount: 1
            })
            await sleep(50)
            await send('Input.dispatchMouseEvent', {
                type: 'mouseReleased',
                x,
                y,
                button: 'left',
                buttons: 0,
                clickCount: 1
            })
            await sleep(settleMs)
        },
        /** 真实按键 */
        async pressKey(key, settleMs = 250) {
            const def = KEYS[key] ?? {
                key,
                code: `Key${String(key).toUpperCase()}`,
                windowsVirtualKeyCode: 0,
                text: key.length === 1 ? key : undefined
            }
            await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...def })
            if (def.text) await send('Input.dispatchKeyEvent', { type: 'char', ...def })
            await send('Input.dispatchKeyEvent', { type: 'keyUp', ...def })
            await sleep(settleMs)
        },
        /** 组合键（modifiers: 1=Alt 2=Ctrl 4=Meta 8=Shift） */
        async pressCombo(key, code, keyCode, modifiers, settleMs = 500) {
            const def = { key, code, windowsVirtualKeyCode: keyCode, modifiers }
            await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...def })
            await send('Input.dispatchKeyEvent', { type: 'keyUp', ...def })
            await sleep(settleMs)
        },
        /** 只封锁指定 URL（如后端 API），保留 dev server —— 模拟"后端未起"的正解 */
        async blockUrls(urls) {
            await send('Network.setBlockedURLs', { urls })
        },
        async unblockUrls() {
            await send('Network.setBlockedURLs', { urls: [] })
        },
        async emulateNetwork({
            offline,
            latency = 0,
            downloadThroughput = -1,
            uploadThroughput = -1
        }) {
            await send('Network.emulateNetworkConditions', {
                offline,
                latency,
                downloadThroughput,
                uploadThroughput
            })
        },
        async setViewport({ width, height }) {
            await send('Emulation.setDeviceMetricsOverride', {
                width,
                height,
                deviceScaleFactor: 1,
                mobile: false
            })
        },
        async clearViewport() {
            await send('Emulation.clearDeviceMetricsOverride')
        },
        clearConsole() {
            consoleEvents.length = 0
        },
        /** 已发出的网络请求 URL（Network.requestWillBeSent）——用于“零网络请求”类断言 */
        requests() {
            return [...requestUrls]
        },
        clearRequests() {
            requestUrls.length = 0
        },
        /**
         * 挂载响应改写规则（CDP Fetch 域）
         * @param {{ urlPattern: string, status?: number, body?: string }} rules
         * @example await cdp.mockResponses([{ urlPattern: '*api/sync/pull', status: 200, body: '{"code":10041}' }])
         */
        async mockResponses(rules) {
            mockRules = rules
            await send('Fetch.enable', {
                patterns: rules.map((rule) => ({
                    urlPattern: rule.urlPattern,
                    requestStage: 'Request'
                }))
            })
        },
        /** 撤销响应改写 */
        async clearMocks() {
            mockRules = []
            await send('Fetch.disable').catch(() => {})
        },
        /** 重新加载页面（冷启动模拟；配合 blockUrls 可模拟“后端未起”） */
        async reload(settleMs = 1500) {
            await send('Page.reload', { ignoreCache: true })
            await sleep(settleMs)
        },
        /** 仅返回与产品告警相关的控制台/异常（过滤 Electron 安全提示等噪音） */
        warnings() {
            return consoleEvents.filter((line) => !/Security Warning/.test(line))
        },
        close() {
            ws.close()
        }
    }
    return api
}

/** 极简 URL 通配匹配（支持 `*`，CDP urlPattern 语义足够） */
function matchUrl(url, pattern) {
    if (!pattern) return false
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(url)
}

function pickConsoleEvent(message) {
    if (
        message.method === 'Runtime.consoleAPICalled' &&
        ['warning', 'error'].includes(message.params.type)
    ) {
        const text = message.params.args
            .map((arg) => arg.value ?? arg.description ?? arg.type)
            .join(' ')
            .slice(0, 300)
        return `${message.params.type}: ${text}`
    }
    if (message.method === 'Runtime.exceptionThrown') {
        const text = message.params.exceptionDetails?.exception?.description ?? ''
        return `exception: ${String(text).slice(0, 300)}`
    }
    if (
        message.method === 'Log.entryAdded' &&
        ['warning', 'error'].includes(message.params.entry.level)
    ) {
        return `log-${message.params.entry.level}: ${String(message.params.entry.text).slice(0, 300)}`
    }
    return null
}

async function waitTarget(port, urlMatch, timeoutMs) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
            const page =
                list.find((t) => t.type === 'page' && t.url.includes(urlMatch)) ??
                list.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
            if (page) return page
        } catch {
            // 端口未就绪，继续等
        }
        if (Date.now() > deadline) {
            throw new Error(`等待 CDP 页面目标超时（port=${port}, urlMatch=${urlMatch}）`)
        }
        await sleep(500)
    }
}