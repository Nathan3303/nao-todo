# @nao-todo/mobileapp

基于 **Lynx（ReactLynx）** 的 NaoTodo 移动端原生应用。当前包含**登录 / 注册 / 登出**完整闭环（身份认证）。

## 运行

```bash
pnpm install                        # 安装依赖（workspace）
pnpm --filter @nao-todo/mobileapp dev     # 启动 dev server，终端出现二维码
pnpm --filter @nao-todo/mobileapp build   # 生产构建（含 TypeScript 类型检查）
pnpm --filter @nao-todo/mobileapp preview # 预览生产构建
```

用 **LynxExplorer App** 扫描终端二维码（`?fullscreen=true`）即可在真机预览。

### API 地址配置（测试服务器）

默认后端地址为**线上测试服务器** `https://todobe.nathanao.space/api`（与 web 生产环境一致，见 `apps/web/.env.production`；代码位于 `src/App.tsx` 的 `API_BASE_URL`）。
**真机扫码即可直接登录测试，无需暴露本地服务器。**

#### 切换回本地后端（可选）

把 `API_BASE_URL` 改为开发机局域网 IP（如 `http://192.168.x.x:3302/api`），需同时满足：

1. 后端监听 `0.0.0.0:3302`（而非仅 `127.0.0.1`）
2. 防火墙放行 3302 端口
3. 手机与开发机处于同一网段且可互通

#### HTTP 499 排障

- **含义**：499 是 Nginx 专有状态码（Client Closed Request）——请求已到达服务器/网关，但客户端在响应前主动断开了连接。
- **常见诱因**：后端响应过慢或网络路径挂起，超过客户端请求超时（`LynxRequester` 为 5s）后客户端断开；也可能是中间网关/代理问题。
- **处置**：优先改用线上服务器验证；若必须用本地后端，先确认上述三项（监听地址/防火墙/网段），再排查后端响应耗时。

## 架构说明

### 包结构

```
apps/mobile                    # 入口与装配（App.tsx：requester/store/usecase 单例 + 页面切换）
packages/presentation-react    # React 展示层（ReactLynx / Lynx）
  ├─ src/logic/                # 框架无关纯 TS：i18n-core、auth-store-core、auth-form-core、compose-auth-usecase、storage-core
  ├─ src/hooks/                # React hooks：useI18n、useAuthStore、useAuthForm（import 自 react，Lynx 端 alias 到 ReactLynx compat）
  └─ src/lynx/                 # Lynx 渲染组件：login/register/home screen + AuthTabs/AuthScreen（lynx-ui）
packages/shared/requester/lynx.ts   # LynxRequester（基于 Lynx 内置 Fetch API）
```

### 跨端复用评估结论

| 层                                                                               | 结论        | 说明                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nao-todo/domain-identity`（AuthService / value objects / AuthRepository 接口） | ✅ 直接复用 | 纯 TS 业务逻辑；AuthUseCase 因 converters 依赖 domain 聚合（→ shared 聚合 → axios/Vue 组件链）未直接复用，由 `compose-auth-usecase` 内联同等逻辑（AuthService/AuthRepository 为 deep import 复用） |
| `@nao-todo/infrastructure`（useAuthRepository）                                  | ✅ 复用     | 只依赖 Requester 接口形状；converters 已改为 deep import value objects                                                                                                                             |
| `@nao-todo/shared` Requester 接口                                                | ✅ 复用     | 新增 `LynxRequester`（`useLynxRequester`）基于全局 fetch 实现同一接口；**AxiosRequester 不可用**（依赖 axios/dexie/localStorage，Lynx 运行时缺失）                                                 |
| `@nao-todo/shared` i18n                                                          | ⚠️ 数据复用 | vue-i18n 实例（Vue 专属）不可用；`locales/messages.ts` 上提纯数据，`src/logic/i18n-core.ts` 实现框架无关 translate + `useI18n`                                                                     |
| `@nao-todo/presentation-identity`                                                | ❌ 不可用   | Vue + Pinia + nue-ui                                                                                                                                                                               |

### 关键技术点

- **导入策略**：Lynx 端一律使用 workspace 包的**深层路径导入**（如 `@nao-todo/shared/requester/lynx`），避免聚合入口拉入 web 专属依赖（axios、Vue 组件等）导致 Lynx 运行时/构建失败。
- **`react` alias**：`lynx.config.ts` 将 `react` alias 到 `@lynx-js/react/compat`，使 presentation-react 的 hooks（import 自 react）在 Lynx 运行。
- **类型检查**：`pluginTypeCheck` 仅检查 `apps/mobile` 自身代码（`issue.exclude` workspace 包路径）；各包类型检查由自身 tsc（presentation-react）与 web 侧 vue-tsc 负责。
- **持久化**：Lynx 无内置 localStorage/IndexedDB；`storage-core` 优先使用 LynxExplorer 内置 `NativeLocalStorageModule`，降级为内存存储（token/语言偏好，重启后内存降级时丢失）。
- **UI 库**：`@lynx-js/lynx-ui`（官方 headless 组件库，Button/Input/Form/KeyboardAware 等），视觉样式在 `src/lynx/*.css` 自绘（深色「深夜任务账本」主题）。