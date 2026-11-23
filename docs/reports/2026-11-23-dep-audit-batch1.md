# T784 / Issue #388 第一批：生产面依赖漏洞（electron / vue-i18n / vue 相关）

**结论**（2026-11-23 · 分支 `chore/388-prod-deps-security` · rd-infra）：生产面三项**全部清零**（electron / vue-i18n 家族 / `@vue/server-renderer`），另顺带清掉 `source-map-js`
（1.2.1 → 1.2.4，随 vue 编译链重解析，非定向升级）。全量 advisory **102 → 86**（-16 / +0）；3 条 critical 仍在 dev 面，不属本批。

## 一、升级与**实际解析版本**（`pnpm install` 后核对，非 `package.json` 范围）

| 包                                           | 范围 改前 → 改后                 | 解析 改前 → 改后                  | 安全线                           |
| -------------------------------------------- | -------------------------------- | --------------------------------- | -------------------------------- |
| `electron`（desktop devDep）                 | `^43.2.0` → `^43.8.12`           | **43.4.1 → 43.8.12**              | ≥43.8.1（留 43.x，未跃迁 44/45） |
| `vue`（root + desktop）                      | `^3.5.34`/`^3.5.40` → `^3.5.46`  | **3.5.41 → 3.5.46**               | —                                |
| `vue-i18n`（root + desktop）                 | `^11.4.4`/`^11.4.6` → `^11.4.23` | **11.4.10 → 11.4.23**             | ≥11.4.14                         |
| `@vue/server-renderer`（传递）               | —                                | **3.5.41 → 3.5.46**               | ≥3.5.42                          |
| `@intlify/*` + `source-map-js`（传递，顺带） | —                                | **11.4.10→11.4.23 / 1.2.1→1.2.4** | ≥11.4.14 / ≥1.2.2                |

要点：`packages/presentation` / `packages/shared` 的 vue 是 `peerDependencies: ^3.5.0`，只改 root/desktop 范围仍残留一条 3.5.41
解析（`pnpm why @vue/server-renderer` 可见）⇒ 用 **`pnpm dedupe`** 收敛到单一 3.5.46（**未改 peer 范围 / 未加 `pnpm.overrides` /
未手改 lockfile**）。`pnpm install` 二次执行 = `Already up to date`、lockfile sha 不变（幂等）。

## 二、审计前后对照（`pnpm audit --json`）

| 口径                | 改前                            | 改后                           |
| ------------------- | ------------------------------- | ------------------------------ |
| 全量 advisory       | **102**（3c / 38h / 41m / 20l） | **86**（3c / 31h / 37m / 15l） |
| `pnpm audit --prod` | 23（11h / 7m / 5l）             | 16（6h / 7m / 3l）             |
| 新增条目            | —                               | **0**                          |

消失 16 条：`electron`×9（含两条 high）、`vue-i18n`+`@intlify/core-base`×2+`@intlify/shared`×1、`@vue/server-renderer`×1、`source-map-js`×1（顺带）⇒ 本批三项按 `module_name` 过滤**整条不存在**。

剩余 86 条按 prod/dev 粗分（`--prod` 为准）：**prod 16** = `fast-uri`(h2/m3/l2)、`follow-redirects`(h3)、`vite`(h1/m3/l1)、
`postcss-selector-parser`(m1)；**dev 70** 以 `undici`(h14/m16/l4)、`brace-expansion`(h6)、`markdown-it`、`engine.io`、
`launch-editor`、`vite-plus`/`vitest` 系为主，3 条 critical 全在 dev（`tinypool`×2、`shell-quote`×1）。

## 三、回归（全跑，非只 lint）

- `vp test --run`（全仓）**rc=0**：491 文件（490 pass / 1 skip）· 3985 例（3979 pass / 6 skip）· **0 红** · 339.3s
- `vp check` **rc=0**：2068 文件格式 OK · 1649 文件 lint+类型 0 error
- `vp run webapp build` **rc=0**（16.6s）· `desktop:build` **rc=0**（20.2s，含 `guard:dist-comments` 116 产物 / 9 条打包器注释）
- 七守卫 `ddd`·`gate-pathspec`·`barrel-imports`·`mobile-imports`·`test-location`·`contrast`·`dist-comments` 全 **rc=0**
- 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` = **0**
- **Electron 最小启动自证（跑通）**：生产产物 `apps/desktop/out/main` 真实启动（`--no-sandbox --remote-debugging-port=9333`，
  CDP 驱动）⇒ `Electron 43.8.12 / Chrome 150.0.7871.250 / Node 24.22.1`；`file://…/renderer/index.html` 加载成功、
  `title="NaoTodo"`、`#app` 存在、`typeof window.desktopAPI === "object"`（preload 生效）、
  console 见 `lifecycle.bootstrap.started → completed`、进程存活无崩溃
- **未跑** `scripts/electron-smoke/run.mjs` 全量：后端 `localhost:3302` 未起（`/api/ping` 无响应）+ 无桌面端凭据（`NAO_QA_EMAIL`/`NAO_QA_PASSWORD` 不入库）⇒ 登录 / 同步类断言未覆盖

## 四、本批顺带修复的守卫假红（`scripts/guard-dist-comments.mjs`，待 qa/pm 独立核）

vue 3.5.46 的 `normalizeStyle` 多了一条字符类内置引号的组合正则 `/"(?:[^"\\]|\\[^])*"|…|\/\*[^]*?\*\//g`；旧解析在字符类的 `"` 处
字符串状态失同步 ⇒ 把紧随其后的 `startsWith("/*")` 误判成块注释 ⇒ `desktop:build` 假红（`vender/vue-ecosystem-*.js:1`）。
修法：仅在「前一个非空白字符是表达式起始符」（`= ( , : [ ! & | ? { } ; >`，该位置 `/` 不可能是除号）时整体跳过正则本体，
其它位置维持旧限制。同一份产物对照：旧守卫 rc=1 → 新守卫 rc=0，注释计数仍为 **9（未放宽）**。失败演练：① 紧贴
`startsWith("/*")` 后注入 `/* 真实泄漏 中文注释 T784 DEF-999 */` ⇒ rc=1 精确命中；② `main/index.js` 追加
`// R5 内部行注释泄漏` ⇒ rc=1；③ 还原 ⇒ rc=0。

## 五、遗留（三出口，全部 = 转办，owner=rd-infra / qa）

- **第二批**：剩余 prod 类 16 条（`vite` 需随 vite-plus 联动；`fast-uri`/`follow-redirects` 走 `overrides` 触碰禁用区）。
- **第三批**：3 条 critical（`tinypool`×2 / `shell-quote`）全在 dev，需 `vitest` 大版本决策（先报 PM 定跃迁节奏）。
- **转 qa**：`electron-smoke` 全量与 `electron-builder --dir` 打包未执行（后端未起 / 无凭据 / 需下载二进制）。
- `FEATURES.md` §19（待确认 / 待修）内无依赖版本口径 ⇒ 本单未改。