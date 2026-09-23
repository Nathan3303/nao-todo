/**
 * 桌面端 CSP 策略（C-58 / AC12 / DEF-8）
 *
 * @description 生产走 `win.loadFile`（`file://`，**无 HTTP 响应头**）⇒ CSP 只能落
 *              `<meta http-equiv="Content-Security-Policy">`（见 `index.html`）。
 *              明文姿态下 CSP 从「建议」升为**准入条件**。
 *
 * 指令与必要性（逐项）：
 * - `default-src 'self'`：兜底。`file://` 文档下 `'self'` 匹配同源本地资源（Electron 官方推荐写法）；
 *   未显式覆盖的取数类（`media-src`/`worker-src`/`frame-src` 等）一律限本地。
 * - `script-src 'self'`：仅允许本应用打包产物；**不含 `'unsafe-inline'`/`'unsafe-eval'`**
 *   （构建产物为外链 ESM，无内联脚本；禁止 eval 直接封死注入执行面）。
 * - `style-src 'self' 'unsafe-inline'`：`index.html` 含内联 `<style>`（字体变量），
 *   且 Vue 的 `:style` 绑定 / 组件运行时注入样式需 `style` 属性级内联；**仅样式放宽**。
 * - `img-src 'self' data: blob: https:`：头像可为外链（`getAvatarSrc` 原样返回 `https://` 外链）、
 *   头像裁剪用 `blob:`、占位/图标用 `data:`。
 * - `font-src 'self' data:`：本地字体（`/fonts/**`）与可能的 `data:` 内嵌字体。
 * - `connect-src 'self' https://todobe.nathanao.space`：仅应用 API 生产源（XHR/fetch）；
 *   桌面端禁用远程 SSE（`VITE_DISABLE_SSE=true`）⇒ 无需 `EventSource` 特例。
 * - `object-src 'none'`：无 `<object>/<embed>` 需求，直接封死。
 * - `base-uri 'none'`：禁止注入 `<base>` 劫持相对路径。
 * - `form-action 'self'`：SPA 表单均 `preventDefault`，无跨源提交需求。
 *
 * 注：`frame-ancestors` / `report-uri` / `sandbox` 在 `<meta>` 投递下**被忽略**
 * （仅 HTTP 头有效）⇒ 不写入本策略；web 侧 CSP 走静态托管响应头（见部署检查单）。
 */
const PRODUCTION_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://todobe.nathanao.space",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'"
]

/** 生产策略（= `index.html` 内 `<meta>` 的内容，测试逐字断言） */
export const DESKTOP_CSP_POLICY = PRODUCTION_DIRECTIVES.join('; ')

/**
 * 桌面 dev 本地 API 源（= `.env.development` 的 `VITE_BASE_URL`）
 *
 * @description dev 后端 `APP_SERVER_URL=http://localhost:3302`，会把头像相对路径拼成
 *              `http://localhost:3302/static/uploads/avatars/...`（**http，非同源**）
 *              ⇒ dev 的 `img-src` 必须放行该源，否则 `<img>` 被 CSP 拦截、头像恒落首字母兜底。
 *              生产头像恒为 `https://`（`img-src ... https:` 已覆盖）⇒ 仅 dev 放宽，生产禁放宽。
 */
const DEV_API_ORIGIN = 'http://localhost:3302'

/**
 * dev 策略（**显式区分，生产禁放宽**）
 *
 * @description 放宽两项：
 *              ① `connect-src`：Vite HMR 需回连 `ws://localhost:<port>`、本地 API 为 `http://localhost:3302`；
 *              ② `img-src`：dev 头像由后端拼为 `http://localhost:3302/...`（见 `DEV_API_ORIGIN`）。
 *              `script-src` 仍不含 `'unsafe-eval'`（Vite dev 用原生 ESM，无需 eval）。由
 *              `electron.vite.config.ts` 的 `apply: 'serve'` 插件在 dev 重写 `index.html` 的 meta；
 *              构建产物恒为生产策略。
 */
export const DESKTOP_CSP_POLICY_DEV = [
    ...PRODUCTION_DIRECTIVES.filter(
        (directive) => !directive.startsWith('connect-src') && !directive.startsWith('img-src')
    ),
    `img-src 'self' data: blob: https: ${DEV_API_ORIGIN}`,
    `connect-src 'self' https://todobe.nathanao.space ${DEV_API_ORIGIN} ws://localhost:* ws://127.0.0.1:*`
].join('; ')