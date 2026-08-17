/**
 * @nao-todo/presentation-react
 * @description React 展示层（ReactLynx / Lynx）。
 *              分层结构：
 *              - src/logic：框架无关纯 TS（i18n 核心、AuthStore、表单核心、usecase 组装），跨端可复用
 *              - src/hooks：React hooks（import 自 react，Lynx 端经 alias react → @lynx-js/react/compat 复用）
 *              - src/lynx：Lynx 渲染组件（JSX 使用 Lynx 内置元素 + lynx-ui），仅 Lynx 运行时可用
 *              聚合入口仅导出 logic 与 hooks（框架无关部分）；lynx 渲染层经子路径
 *              '@nao-todo/presentation-react/src/lynx' 访问，避免聚合导出拉入 Lynx 专属依赖。
 */
export * from './src/logic'
export * from './src/hooks'