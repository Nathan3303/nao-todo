# SHELL-05（QA2）生产构建离线进入复现 + `useRouter()` undefined 根因诊断

- **日期**：2026-09-13
- **角色**：QA（测试工程师）
- **任务**：`SHELL-05-QA2`（生产构建离线回归 + 注入诊断，**只测不改**）
- **被测基线**：`nao-todo@581a3c67`（`v1.6.0-15-g581a3c67`，工作区无功能性改动）
- **运行方式**：**production 构建**（`pnpm desktop:build` = `electron-vite build`），`file://` 加载 `apps/desktop/out/renderer/index.html`，Electron `43.4.1` / Chromium `150.0.7871.224`，CDP 端口 `9333`
- **证据**：`docs/reports/evidence/shell-05/prod-build-offline-entry.json`、`prod-build-offline-entry-after-10s.png`、`prod-useRouter-diagnosis.mjs`
- **结论**：✅ **生产态复现成功，与用户报错逐字一致**；根因 = **生产包内存在两份 `vue-router` 实例**（`apps/desktop` 与 `apps/web` 各自解析到不同 pnpm store），`AppRoot.vue` 的 `useRouter()` 从「未被安装的那份」注入 → 返回 `undefined` → `onOffline` 里 `router.replace` 抛 `TypeError`。**dev 不复现是因为 Vite 预打包把 `vue-router` 去重成单实例**——这是一个**构建解析问题，dev/prod 表现分叉**，与用户 App 版本新旧无关：当前 HEAD 源码同样可复现。

---

## 0. 判定速览

| 问题 | 结论 |
| :--- | :--- |
| 生产态能否复现「点击离线进入无反应」 | ✅ **能**（门 30s 不动，`hash` 不变） |
| 报错是否与用户一致 | ✅ **逐字一致**：`TypeError: Cannot read properties of undefined (reading 'replace')` @ `u`(AppRoot.onOffline) |
| `useRouter()` 是否 undefined | ✅ **确认**：运行时在 app 上下文调用该 chunk 导出的 `useRouter` 返回 `undefined`（而 `$router` 正常存在） |
| 根因 | ✅ **双 `vue-router` 实例**（构建图 + 运行时双证）：`apps/desktop/…/AppRoot.vue` → store A；`apps/web/...`（含 `router.ts` 的 `createRouter`）→ store B |
| 是否旧包残留 | ❌ 不是。当前 HEAD 重建即复现（故与用户 app chunk hash 不同无关） |

---

## 1. 生产构建与 hash 对比

构建命令：`pnpm desktop:build`（渲染进程 terser 生产丑化 + manualChunks vendor 拆分）。

| # | 构建 | API Base | `index` 入口 chunk | sha256 | 备注 |
| :-: | :--- | :--- | :--- | :--- | :--- |
| B1 | 默认生产构建 | `https://todobe.nathanao.space/api` | `index-BRaOVFTK.js`（171.07 kB） | `2407fd0d51781df60d7201dd98e455f4f344300afd26aa61d1be755382e44958` | 用于 hash 对比 / 构建图核验 |
| B2 | 覆盖 `VITE_API_BASE_URL=http://localhost:3302/api` | `http://localhost:3302/api` | `index-Dr1MGVC-.js`（171.06 kB） | `27078d9ceff90f044bc77495313669f87ce20f10e6e51f357d2d3eba145afd03` | **运行复现用**（可连本地后端登录建密钥包） |
| — | 用户报错产物 | — | `index-DOz7xaey.js` | —（用户提供） | **与本地产物名不同 ≠ 用户跑旧包**：B1/B2 均复现同一缺陷 |

- 两份 vendor chunk 在 B1/B2 中一致（与 API base 无关）：
    - `assets/vender/vue-router-DrofmNyp.js` = `25e231146f6198722b011f6c8ed05c0c1739f4d0ca8c1b6b059d91f10af3f0bb`
    - `assets/vender/vue-ecosystem-Dowj-6PF.js` = `b6bd2251b40cb32a683c88dc400deca09a6d8a11e720c7462d4a68dc339f4296`
- **B2 与用户产物差异说明**：入口 chunk 名差异来自源码 revision 不同；但缺陷由**依赖解析形状**决定，B1/B2 都命中 ⇒ 用户包命中间一形状。产物名不可直接比对，结论以缺陷复现为准。

---

## 2. 复现（用户路径，B2 生产产物）

路径：`file://…/index.html` 冷启动 → 去壳在线登录（建立本地密钥包）→ 封锁 `localhost:3302` + reload → 输入本地密码解锁 → 初始同步门失败态 → **点击「离线进入」** → 抓 300ms/3s/10s/30s。

| 时间窗 | `location.hash` | `router.currentRoute.name` | `.initial-sync-gate` | `.sync-rail-btn` | 可交互元素 | 结论 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 点击前 | `#/auth/checkin` | `auth-checkin` | 在 | 无 | 3（重试/离线进入/登出用户） | — |
| +300ms | `#/auth/checkin` | `auth-checkin` | **在** | 无 | **3** | 无变化 |
| +3s | `#/auth/checkin` | `auth-checkin` | **在** | 无 | **3** | 无变化 |
| +10s | `#/auth/checkin` | `auth-checkin` | **在** | 无 | **3** | 无变化 |
| +30s | `#/auth/checkin` | `auth-checkin` | **在** | 无 | **3** | 无变化 |

Console（原始，完整见 JSON）：

```text
error: [sync] 拉取归一化错误（断网/超时） ERR_NETWORK
error: TypeError: Cannot read properties of undefined (reading 'replace')
    at u (file:///.../out/renderer/assets/index-Dr1MGVC-.js:2:155494)
    at Pn (file:///.../out/renderer/assets/vender/…)
（该错误出现两次）
```

- 与用户栈完全对齐：`u` = `AppRoot.onOffline`，`const t = ve()`（`ve` = 入口从 `vender/vue-router-*.js` 导入的 `useRouter`），`t.replace(...)` 处 `t === undefined`。
- 注：本生产构建中该异常经 Vue 事件处理链被 → `console.error`（我的 `unhandledrejection` 探针未捕获到；dev 全断网场景下则表现为 `unhandledrejection`）。判定以 console 栈为准。
- 截图：`prod-build-offline-entry-after-10s.png`（点击后 10s 仍停在门）。

---

## 3. `useRouter()` 为何 undefined —— 运行时诊断（CDP）

诊断脚本：`docs/reports/evidence/shell-05/prod-useRouter-diagnosis.mjs`（在页面内 `import()` 入口实际引用的 vue-router chunk，并在 **app 上下文**调用其导出）。

```json
{
  "exported": ["a", "b", "c", "d", "u"],
  "results": {
    "b": { "call": "OK",  "isRouter": true,  "sameAsGlobal": true  },
    "c": { "call": "THREW", "err": "Cannot read properties of undefined (reading 'routes')" },
    "u": { "call": "OK",  "valIsUndefined": true, "sameAsGlobal": false }
  },
  "globalRouter": "defined"
}
```

- `globalProperties.$router` **存在**（object）——说明 router 已安装、且安装的是「**能正常工作**的那份」。
- `provides` 里 **只有一个** router symbol（`app._context.provides` 共 5 个 symbol，其中 1 个 `isRouter`）。
- **`u`（= AppRoot 实际 import 的 `useRouter`，入口映射 `u as ve`）在同一 app 上下文调用返回 `undefined`**；而 `b` 返回全局 router（`sameAsGlobal: true`）。
    ⇒ 同一个 chunk 文件里存在**两套 `routerKey` 注入契约**，AppRoot 用的是**未被 `app.use()` 安装**的那一套。
- 无法读取 AppRoot 实例的 `setupState`（生产构建下为 `null`），故以上「在 app 上下文调用 entry 实际引用的 `useRouter`」是等价且更直接的判定。

### 3.1 构建图核验（stats.html）

`pnpm desktop:build` 生成的 `apps/desktop/stats.html` 中，`vue-router@5.2.0` 出现**两个不同 pnpm store 路径**：

```text
vue-router@5.2.0_…_@voidzero-dev+vite-plus-core@_bb667dd5…/node_modules/vue-router/dist/{vue-router.js,useApi-*.js,devtools-*.js}
vue-router@5.2.0_…_@vue+compiler-sfc@3.5.41_esbu_9956ded6…/node_modules/vue-router/dist/{vue-router.js,useApi-*.js,devtools-*.js}
```

对比：`vue@3.5.41`、`pinia@3.0.4`、`axios`、`dexie` 在 stats 中均**仅一份** ⇒ **双实例问题特定于 `vue-router`**。

---

## 4. 根因链（为什么 dev 正常、prod 必坏）

```text
apps/desktop/node_modules/vue-router  ──→ store A（…_@vue+compiler-sfc@3.5.41_esbu_…）
        ▲ AppRoot.vue: import { useRouter } from 'vue-router'   ← 命中 A
node_modules/vue-router (root)        ──→ store B（…_@voidzero-dev+vite-plus-core@_bb667…）
        ▲ apps/web/src/router.ts: import { createRouter, createWebHashHistory }  ← 命中 B
          apps/web/src/components/**（useRouter/useRoute）      ← 命中 B
```

- `apps/web/node_modules/vue-router` **不存在** → web 侧沿目录上溯解析到**根 `node_modules`（copy B）**。
- `apps/desktop/node_modules/vue-router` **存在**（pinned 到 copy A）→ 仅 `AppRoot.vue` 命中 A（全仓 desktop 只有它 import `vue-router`，已核验）。
- `manualChunks` 按包名子串把两份都归入同名 `vender/vue-router` → 同一 chunk 文件内共存两套模块作用域 / 两套 `routerKey` Symbol。
- `router` 由 web 的 copy B `createRouter` 创建并 `app.use()` 安装（提供 B 的 key）。`AppRoot` 用 A 的 `useRouter` → `inject(A.routerKey)` = `undefined`。
- **dev 为何好**：Vite `optimizeDeps` 预打包 `vue-router` 为单一 dep 实例（同一 URL），dev 下所有 import 都指向它 ⇒ 无分叉。生产 Rollup 按真实磁盘解析 → 分叉暴露。

**影响面（同类风险）**：

1. `AppRoot.onOffline` ✅ 已复现。
2. `AppRoot.onSignOut`、`syncService.setSessionExpiredListener` 内 `router.replace('/auth/signin')` —— 同一 `router` 引用，**同型必坏**（未单独实测，静态确定）。
3. 其余 web 组件（`built-in-project.ts`、`sign-in-page.vue` 等）用 copy B ⇒ 正常，故线上「大部分功能可用」，唯独桌面壳上的 AppRoot 导航失效——与用户「只有离线进入点了没反应」的现象一致。

---

## 5. 修复建议（**仅建议，本次未改任何代码**）

1. **首选（最小、根治）**：在 `apps/desktop/electron.vite.config.ts` 的 `renderer.resolve` 增加去重：
   ```ts
   resolve: { dedupe: ['vue', 'vue-router', 'pinia'], alias: [ … ] }
   ```
   （`vue`/`pinia` 当前恰好单实例，一并 dedupe 可防回归。）
2. **依赖收敛**：把 `vue-router` 显式声明进 `apps/web/package.json`，使 web/desktop 解析同一 store 版本；或在根 `package.json` 加 `pnpm.overrides` 统一 peer 变体。
3. **兜底（与 SHELL-05 主单一致）**：`onOffline`/`onSignOut` 加 `try/catch/finally`，确保 `gatePassed` 必达；并注册 `router.onError`。
4. **回归门禁**：CI 增加「生产包 vendor 去重」断言（如 `stats.html` 中同一包不得出现 ≥2 个 store 路径），或至少对 `vue-router` 断言单实例。

---

## 6. 冻结文件 hash 清单（未改动，`sha256`）

被测源码（只读）：

```text
2c21620432c58afb377c2042ce954ae0ce4e987f22b3f2ba15b42807a322cb83  apps/desktop/src/renderer/src/AppRoot.vue
f6f3061870e6a870dbfc07dfb0faaa2737444d76cae1adf6cfd3fddbd474b20b  apps/desktop/src/renderer/src/components/initial-sync-gate.vue
7400ebe0d984d2d5382849b100f549bc0ec9427c20415c7ad99e263e1fe1d3ca  apps/web/src/views/auth/routes.ts
1d462d5d4cae51165995f02fc2e7c47e9d764359940c9665c9ce72b44a7696de  apps/web/src/router.ts
0461ed7430ec0d1afa362d8ca8c0c3c79ebb8437e859721f397bef4227b2f0a1  packages/presentation-identity/src/components/deletion-notifier/index.vue
```

构建产物（本次生成，`out/` 为 git 忽略目录；供复核）：

```text
25e231146f6198722b011f6c8ed05c0c1739f4d0ca8c1b6b059d91f10af3f0bb  assets/vender/vue-router-DrofmNyp.js（B1/B2 一致）
2407fd0d51781df60d7201dd98e455f4f344300afd26aa61d1be755382e44958  assets/index-BRaOVFTK.js（B1 默认 API）
27078d9ceff90f044bc77495313669f87ce20f10e6e51f357d2d3eba145afd03  assets/index-Dr1MGVC-.js（B2 localhost API，运行复现用）
636497ada80676ba46e9dbb305062c3a571fc79c2ae6c69b9d26eee021812982  out/renderer/index.html
```

---

## 7. 脚手架改动披露

- **本轮未新增脚手架文件**；仅对上一轮新增的 `scripts/electron-smoke/shell-05-offline-repro.mjs` 增加一个只读参数 `--url-match`（默认值不变 `localhost:5173`），以支持指向生产产物的 `file://` 页面。**未改 `run.mjs` / `lib/*` / 任何 `checks/*` / 任何功能代码。**
- 新增文档：`docs/reports/SHELL-05-prod-offline-entry.md`、`docs/reports/evidence/shell-05/prod-*`。

---

## 8. 遗留 / 阻塞

1. **用户 app chunk `index-DOz7xaey.js` 未能本地复刻**：无该旧产物二进制，无法逐字节比对；但当前 HEAD 生产构建（B1/B2）已复现同一错误栈，判定「非旧包残留」。**建议用户用当前源码 `pnpm desktop:build` 重建后复测**（预期仍复现，除非先落地 §5 修复）。
2. **`onSignOut` 与 `sessionExpired` 路径未单独实机复现**（同 `router` 引用，静态判必坏），如需可补一条注入用例。
3. **测试数据**：沿用上轮一次性账号 `qa.shell05.1789301180@qa.local`（dev 库无 DELETE 端点）；运行以 `XDG_CONFIG_HOME=/tmp/nao-shell05-prod` 隔离，未污染用户 `~/.config/@nao-todo/desktopapp`。
4. 生产构建属**产物级**验证，未做 `electron-builder` 打包（`dist`）；`file://` 加载方式与打包态一致，判定风险低。
