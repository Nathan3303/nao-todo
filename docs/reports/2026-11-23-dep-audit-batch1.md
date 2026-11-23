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

## 六、批次二（T786 / Issue #388）：生产面剩余 16 条清零

**结论**（2026-11-23 · 分支 `chore/388-deps-batch2` · rd-infra）：`pnpm audit --prod` **16 → 0**（high / moderate / low 全为 0）。
四个包**全部停在同主版本内的小/补丁级**，无大版本跃迁；**未使用 `pnpm.overrides`**、未改 Node 基线 / `packageManager`。

### 6.1 升级与实际解析版本（`pnpm install` 后核对 `.pnpm` / `apps/*/node_modules`，非 `package.json` 范围）

| 包                         | 位置                               | 范围改前 → 改后     | **解析改前 → 改后** | 安全线           |
| -------------------------- | ---------------------------------- | ------------------- | ------------------- | ---------------- |
| `vite`（真实 vite）        | `apps/desktop` devDep              | `^7.3.6` → `^7.3.7` | **7.3.6 → 7.3.8**   | ≥7.3.7（留 7.x） |
| `follow-redirects`（传递） | `axios`                            | —                   | **1.16.0 → 1.16.3** | ≥1.16.2          |
| `fast-uri`（传递）         | `ajv`（webpack / cssnano 链）      | —                   | **3.1.6 → 3.1.9**   | ≥3.1.9           |
| `postcss-selector-parser`  | `cssnano` → `postcss-calc` 等 6 处 | —                   | **7.1.5 → 7.2.1**   | ≥7.1.6           |

### 6.2 升级手法（无 override、无手改 lockfile）

`pnpm update -r <pkg>` 在本仓 pnpm 11 下**只作用于 `package.json` 直接依赖** ⇒ 三个纯传递包裸跑无变化（实测 `--depth Infinity` 亦然）。
采用：`pnpm add -w -D <pkg>@^<安全线> --lockfile-only` → `pnpm dedupe --lockfile-only`（在各消费者范围 `^3.0.1` / `^7.0.0` /
`^7.1.1` 内收敛到单一安全版）→ `pnpm remove -w <pkg> --lockfile-only` → `pnpm install`；root `package.json` 恢复原样
（`pnpm add/remove` 会把整文件行尾改写成 LF）。`vite` 是真实直接依赖，直接调范围即可。

`fast-uri` 那条标 `patched: none` 的 advisory（1239946，命中区间 `=3.1.6`）随解析升到 3.1.9 **不再命中**；按 `module_name`
过滤，`fast-uri` 在 `--prod` 报告中**整条不存在**（7 条全消）。

### 6.3 审计前后对照

| 口径                | 第一批后                   | 批次二后                       |
| ------------------- | -------------------------- | ------------------------------ |
| `pnpm audit --prod` | 16（6h / 7m / 3l）         | **0**（0 / 0 / 0 / 0）         |
| 全量 advisory       | 86（3c / 31h / 37m / 15l） | **70（3c / 25h / 30m / 12l）** |
| 新增条目            | —                          | **0**                          |

消失 16 条 = `vite`×5 + `fast-uri`×7 + `follow-redirects`×3 + `postcss-selector-parser`×1。

### 6.4 回归（全仓真跑）

- `vp test --run`（全仓）**rc=0**：491 文件（490 pass / 1 skip）· 3985 例（3979 pass / 6 skip）· **0 红** · 293.4s（跑前 `pgrep -af vitest` 空）
- `vp check` **rc=0**：2069 文件格式 OK · 1649 文件 lint + 类型 0 error
- 七守卫全 **rc=0**：`ddd` · `barrel-imports`（1856 导入 / 2676 命名）· `mobile-imports`（72 文件）· `gate-pathspec` ·
  `test-location`（483 文件）· `contrast`（17 组 pair）· `dist-comments`（116 产物 / 9 条打包器 banner）
- `vp run webapp build` **rc=0**（15.4s）· `desktop:build` **rc=0**（18.4s）
- 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` = **0**
- `pnpm install --frozen-lockfile --lockfile-only` **rc=0**（`Already up to date` ⇒ CI 冻结锁文件口径成立）；lockfile 净变更 = 4 个包
  （31+ / 32-：`vite` peer 哈希连带 `vue-router` / `unplugin` / `electron-vite` 等 8 处引用行）

### 6.5 遗留（三出口）

- **接受（含到期 · owner=rd-infra · 到期 2026-12-31）**：dev 面 `vite-plus@0.2.6` 仍带**同一批 5 条** vite 类 advisory
  （advisory id 不同：1242621 / 1242650 / 1242657 / 1242723 / 1242729，`patched >=1.0.1`）—— 修它需 `vite-plus` **0.2.6 → 1.x**
  **大版本跃迁**，本单明令禁止 ⇒ 待 PM / arch 定跃迁节奏
- **转办（下一批 · owner=rd-infra）**：dev 面 `launch-editor` 2.14.1 → 2.14.2（3 条，补丁级；随 vite-plus 升级一并处理更省事）
- **不变**：3 条 critical（`tinypool`×2 / `shell-quote`）仍只在 dev，需 `vitest` 大版本决策