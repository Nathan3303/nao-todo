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

## 七、批次三（T789 / Issue #388）：dev 面 **Batch A** —— exact-key overrides（70 → 10，critical 清零）

**结论**（2026-11-23 · 分支 `chore/388-deps-batch3` · rd-infra）：全量 advisory **70 → 10**（critical **3 → 0**），
`--prod` 保持 **0**，新增条目 **0**。手法 = `pnpm-workspace.yaml` 的 `overrides` 段**只加覆盖、不动 `package.json` 范围**：
9 条新增 + 1 条抬门槛（`serialize-javascript`）。**未升 `vite-plus` / `vitest` 系 / 任何主版本**，未改 Node 基线 /
`packageManager`，未手改 lockfile。

### 7.1 Batch A 配方表（键 / 值 / 解析 改前 → 改后 / 为什么必须 override / 何时可删）

| override 键              | 值        | 解析 改前 → 改后        | 条数    | 为什么必须 override（parent 精确 pin / 上游未跟进） | 何时可删              |
| ------------------------ | --------- | ----------------------- | ------- | --------------------------------------------------- | --------------------- |
| `tinypool`               | `2.1.2`   | 2.1.0 → 2.1.2           | 2c      | `oxfmt@0.60.0` **精确 pin `2.1.0`**                 | oxfmt 内置 ≥2.1.2 后  |
| `shell-quote`            | `1.12.0`  | 1.9.0 / 1.10.0 → 1.12.0 | 1c      | `concurrently@10.0.5` **精确 pin `1.9.0`**          | concurrently 跟进后   |
| `launch-editor`          | `2.14.2`  | 2.14.1 → 2.14.2         | 3       | `@rsdoctor/sdk@1.6.3` 未跟进（可随 vite-plus 联动） | 其跟进后 / Batch B 后 |
| `engine.io@~6.6.0`       | `6.6.12`  | 6.6.9 → 6.6.12          | 1h      | `socket.io@4.8.1` 声明 `~6.6.0` 未跟进              | socket.io 跟进后      |
| `markdown-it@^14.3.0`    | `14.3.3`  | 14.3.0 → 14.3.3         | 4       | `@lynx-js/web-elements@0.12.7` 未跟进               | 其跟进后              |
| `dompurify@^3.4.12`      | `3.5.0`   | 3.4.14 → 3.5.0          | 5l      | 同上（同一 parent）                                 | 同上                  |
| `serialize-javascript`   | `>=7.1.4` | 7.1.0 → 7.1.4           | 1l      | **抬既有门槛**（原 `>=7.0.5`，patched ≥7.1.3）      | 上游跟进后            |
| `undici@6.28.0`          | `6.29.1`  | 6.28.0 → 6.29.1         | 34 合计 | `node-gyp@12.4.0` 声明 `^6.25.0` 未跟进             | node-gyp 跟进后       |
| `undici@7.29.0`          | `7.30.1`  | 7.29.0 → 7.30.1         | ↑       | `@electron/get@5.1.0` 声明 `^7.24.4` 未跟进         | 其跟进后              |
| `undici@8.10.2`          | `8.13.1`  | 8.10.2 → 8.13.1         | ↑       | `jsdom@30.0.1` 声明 `^8.9.0` 未跟进                 | 其跟进后              |
| `brace-expansion@1.1.18` | `1.1.21`  | 1.1.18 → 1.1.21         | 9 合计  | `minimatch@3.1.5` 声明 `^1.1.7` 未跟进              | minimatch 跟进后      |
| `brace-expansion@2.1.4`  | `2.1.7`   | 2.1.4 → 2.1.7           | ↑       | `minimatch@5.1.9` / `@9.0.9` 声明 `^2.x`            | 同上                  |
| `brace-expansion@5.0.9`  | `5.0.12`  | 5.0.9 → 5.0.12          | ↑       | `minimatch@10.2.6` 声明 `^5.0.8`                    | 同上                  |

条目数口径：`tinypool` 的 2 条中的 1 条已在 `@lynx-js/template-webpack-plugin` 侧修好（本就是 2.1.2），覆盖只是把
`oxfmt` 那条拉齐。`undici` 的 34 条、`brace-expansion` 的 9 条按包合计，不逐 major 拆分。

**一处与 T788 配方的偏差（已实测，如实报）**：`engine.io` 取 **`6.6.12`** 而非 `6.6.13`。原因：`6.6.13` 于
`2026-11-23T11:54Z` 发布（距本单执行 <4h），落在 pnpm 11 默认 `minimumReleaseAge` 的 24h 冷却窗口内 ⇒ 首次
`pnpm install` **自动往 `pnpm-workspace.yaml` 追加了一条 `minimumReleaseAgeExclude: engine.io@6.6.13`**（并把整份文件
重写成 2 空格 / LF，破坏既有 4 空格 + CRLF 基线）。`6.6.12` 同为 patched（advisory 1240112 要求 ≥6.6.10）、已过冷却
⇒ 用它可以**不引入任何 `minimumReleaseAgeExclude` 例外**，audit 条数不变（仍是 10）。取舍理由：不为一条 4 小时新版本
开供链例外，也不接受 `pnpm-workspace.yaml` 被工具重排整份格式。

### 7.2 exact-key 的失配风险与自检方式（**本批主要遗留风险**）

pnpm 的 override 键判定是 **`isIntersectingRange(覆盖键的区间, 依赖方「声明的」范围)`**（`createVersionsOverrider` →
`pickVersionOverride`，pnpm 11.18.0 源码核对）。由此派生出三个必须知道的性质：

1. **精确版本键天然锁 major**：`undici@6.28.0` 之所以只命中 `node-gyp`，是因为 `6.28.0 ∈ ^6.25.0`；而它与
   `^7.24.4` / `^8.9.0` 不相交 ⇒ 不会跨线。这是「按 major 分 exact-key」可行的根本原因。
2. **⛔ 范围选择器会跨 major 强推**：`undici@^6: 8.13.1` 这类写法会命中**所有**与 `^6` 相交的需求方，并把它们的
   声明**替换成 8.13.1**（override 的值不受原范围约束）。T788 实测：`brace-expansion@^1: 5.0.12` 会把
   `minimatch@3.1.5`（声明 `^1.1.7`）的 `brace-expansion` 推到 5.x ⇒ **直接推坏**。⇒ 本批**只用精确版本键**。
3. **⚠️ 静默失配（最危险）**：键匹配的是依赖方**当前声明**。若上游把声明抬出键的区间（例：`node-gyp` 从 `^6.25.0`
   改到 `^6.30.0`），`undici@6.28.0` 这条**不再命中 ⇒ 覆盖静默失效**，解析退回带漏洞版本 —— 而
   `pnpm install` 仍 rc=0、`vp check`/`vp test`/七个守卫**全部照绿**（没有任何既有门禁读 advisory）。
4. **反向风险**：上游修好后覆盖会变成「多余的版本钉死」，长期把包压在旧版本上。

**自检方式**：`pnpm run guard:audit`（`scripts/guard-audit.mjs`）—— 跑 `pnpm audit --json`，断言
**critical = 0** 且 **总数 ≤ `MAX_TOTAL`**（当前常数 **12**，实测 10，留 2 条余量；常数在脚本内，改动需说明理由）。
退出码 `0` 通过 / `1` 判据不满足（打印按包归并的剩余条目）/ `2` 环境错误（pnpm 不可用、输出非 JSON）。
**运行时机**：发版前、批末、以及**每次改 `overrides` 前后各一次**。

**失败演练（三段证据，2026-11-23 实测）**：

| 演练                                                         | 期望                                         | 实测                                                                 |
| ------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------- |
| ① `MAX_TOTAL` 临时改 `12 → 0`（其余不动）                    | exit 1                                       | `advisory 总数 10 > 阈值 0` ⇒ **rc=1**                               |
| ② 临时注释掉 `tinypool: '2.1.2'`（真实故障：覆盖丢失）+ 重装 | exit 1（走 critical 分支，**不是**计数分支） | 总数 **12 == 阈值 12**（计数判据本会放行）但 `critical 2` ⇒ **rc=1** |
| ③ 还原 ①② 后复跑                                             | exit 0                                       | `advisory 总数 10（阈值 12）· critical 0` ⇒ **rc=0**                 |

演练 ② 是关键：它证明 **critical 判据能独立拦住「总数没超但覆盖已失效」**，而这正是本批最可能出现的退化形态。

### 7.3 审计前后对照（`pnpm audit --json`，真跑）

| 口径                | 批次二后                       | **批次三后**                |
| ------------------- | ------------------------------ | --------------------------- |
| 全量 advisory       | **70**（3c / 25h / 30m / 12l） | **10**（0c / 1h / 8m / 1l） |
| `pnpm audit --prod` | 0                              | **0**                       |
| 新增条目            | —                              | **0**                       |

消失 **60** 条 = `undici`×34 + `brace-expansion`×9 + `dompurify`×5 + `markdown-it`×4 + `launch-editor`×3 + `tinypool`×2

- `engine.io`×1 + `serialize-javascript`×1 + `shell-quote`×1。按 `module_name` 过滤，这 9 个包在**全量报告里整条不存在**。
  **与 T788 预测一致（预测 10 / critical 0，实测 10 / critical 0）**，唯一差异是 `engine.io` 用 6.6.12（见 §7.1 末段），
  不影响条数。

### 7.4 回归（全仓真跑）

- `vp test --run`（全仓，跑前 `pgrep -af vitest` 空）**rc=0**：**491 文件**（490 pass / 1 skip）· **3985 例**
  （3979 pass / 6 skip）· **0 红** · 548.3s（同机负载较高，批次二为 293.4s；例数与红数一致）
- `vp check` **rc=0**：2069 文件格式 OK · 1650 文件 lint + 类型 **0 error**（+1 文件 = 新增的 `scripts/guard-audit.mjs`）
- 七守卫全 **rc=0**：`ddd` · `barrel-imports`（1650 文件 / 1856 导入 / 2676 命名）· `mobile-imports`（72 文件）·
  `gate-pathspec` · `test-location`（483 文件）· `contrast`（17 组 pair）· `dist-comments`（116 产物 / 9 条打包器 banner）
- `vp run webapp build` **rc=0**（22.2s）· `desktop:build` **rc=0**（29.4s）
- 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` = **0**
- `pnpm install --frozen-lockfile` **rc=0**（`Already up to date` ⇒ lockfile 自洽）；`pnpm install` 连跑 2 次
  = 第 2 次 `Already up to date` + lockfile **sha 不变**（幂等）
- lockfile 净变更 **65+/66-**（含新增的 `overrides:` 映射段与 13 个包的解析重定向）

### 7.5 剩余 10 条与出口（**全部 = 接受含到期 / 转办，到期 2026-12-31**）

| 包               | 条数          | patched 线 | 为什么本批不动                                             | 出口                                        |
| ---------------- | ------------- | ---------- | ---------------------------------------------------------- | ------------------------------------------- |
| `vite-plus`      | 5（1h/3m/1l） | `>=1.0.1`  | 需 **0.2.6 → 1.x 主版本跃迁 = 换工具链**，本批明令禁止     | 接受（到期 2026-12-31）+ **Batch B 另立单** |
| `vitest`         | 1             | `>=4.1.11` | 与 `vite-plus` 的 vitest peer 绑定联动，属 Batch A+ 暂不做 | 接受（到期 2026-12-31）+ Batch B / A+ 承接  |
| `@vitest/mocker` | 2             | `>=4.1.12` | 同上（随 `vitest` 同版本船）                               | 同上                                        |
| `glob`           | 1             | `>=14.0.2` | 解析 13.0.6 / 7.2.3，**跨大版本**，上游无兼容解            | 接受（到期 2026-12-31）+ **转办上游观察**   |
| `minimatch`      | 1             | `>=11.0.1` | 解析 10.2.6 / 9.0.9，**跨大版本**（9 条 parent 边）        | 同上                                        |

到期处理：2026-12-31 前若 `vite-plus` 跃迁落地（Batch B）⇒ 前三条随之消失；`glob` / `minimatch` 若上游仍无 13.x / 10.x
线补丁，则**续期并登记新到期日**，不得默默过期。

### 7.6 Batch B 建议（`vite-plus` 1.3.0）—— **另立单，不并入本批**

- **为什么另立**：`vite-plus` 0.2.6 → 1.x 是**换工具链级**变更（同时牵动 `catalog` 里
  `vite: npm:@voidzero-dev/vite-plus-core@0.2.6`、`oxfmt@0.60.0` / `oxlint@1.75.0` 的 peer、以及 `vitest` 4.1.10），
  影响面是全仓构建 + 测试 + 格式化三套门禁，与「依赖补丁级清零」不同风险类别。
- **目标版本需重估**：T788 探索时按 `1.3.0` 估算，但当前 npm `latest` 已是 **1.7.0** ⇒ Batch B 开单时须重新评估目标
  版本，并同步 `catalog` 与 `overrides`（`tinypool` / `launch-editor` 两条很可能会随上游跟进**自然失效 ⇒ 直接删**）。
- **建议单内容**：① 在 `git worktree` 固定提交里做 A/B（禁止直接在主工作区构建，AGENTS.md「前后对照测量纪律」）；
  ② 判据以**硬指标**（模块图 / ΣVue SFC / import 聚合）为准，wall 不作判据；③ 先 `guard:audit` 取基线，
  升完复跑，确认 5 条消失且无新增。