# 2026-11-20 全仓体检报告（缺陷 / 不一致 / 低效 / 死代码）

> 性质：**一次性全仓体检**（PM 发起，用户 2026-11-20 批准「全部搞定」）。基线门禁全绿，问题集中在环境锁定、死代码与文档漂移。
> 修复批次：分支 `chore/2026-11-20-audit-governance`（自 `origin/main` `787b301b`），Issue 见下。

## 零、基线（本报告全部结论的对照点）

- `pnpm exec vp check`：**1987 文件格式 OK · 1584 文件 lint/类型 0 告警**（node 24.22.1）。
- 五守卫 `guard:ddd` / `guard:gate-pathspec` / `guard:barrel-imports` / `guard:mobile-imports` / `guard:test-location`：**rc=0**。
- 全仓测试（`node 24.22.1`）：**449 文件 / 3489 例 / 3483 通过 / 6 跳过 / 0 红**。
- i18n：`zh-CN` 与 `en-US` 各 **1058 键，零差集**。
- 移动端红线：`packages/presentation-react` + `apps/mobile` 零改动。

## 一、已修（本批提交，仅文档层）

| 项                     | 内容                                                                                                                                                                                       | 证据                                                                                                                                                              |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md` 机制段漂移 | pin `0.21.1 → 0.26.0`；运行前提 `tmux-only → herdr 默认 / tmux 回退`；角色 `6 → 7`（补 `uiux-designer`）；角色卡版本 `v31/v16/… → v39/v17/v15/v14/v14/v6/v2`；清单计数改为 `0.26.0` 现场值 | 逐条比对 `.pi/npm/node_modules/@nathan33/nao-skill`（`package.json` 0.26.0、`.agents/prompts/*.md` 的 `version:`、`grep -cE '^- \[ \]' .agents/checklists/*.md`） |
| 缺陷池状态滞后         | `DEF-138/139/141/142/143/145/146/148/150/151/152` 仍写「🚧 修复中 / 待派单」，实际已闭环                                                                                                   | `CHANGELOG.md` 各版本条目 + 服务端 PR #90/#91                                                                                                                     |
| 缺陷池行内重复         | `DEF-143` 整行内容粘贴两遍（首份被截断），已去重                                                                                                                                           | `node` 定位同一行内两处 `\| DEF-143 \|`                                                                                                                           |
| `DESIGN.md` 死路径     | 字段标签文件已随 T696 M5 下沉，文档仍指 `apps/web/src/components/sync/conflict-field-labels.ts`                                                                                            | 实文件在 `packages/shared/utils/conflict-field-labels.ts`                                                                                                         |

## 二、P1 · 环境未锁 Node（唯一会持续制造「假红」的一项）

**实测对照**（同一份代码、同一 lockfile）：

- `node 24.22.1` ⇒ `449 文件 / 3489 例 / 0 红`。
- `node 26.12.1` ⇒ `95 文件 / 597 例失败`。

**根因（已反证）**：Node 26 在 `globalThis` 上暴露了 Web Storage 访问器（无 `--localstorage-file` 时提示 `localStorage is not available`），vitest 的 jsdom 环境因此**不再注入** `localStorage` ⇒ 依赖它的用例拿到 `undefined`。加 `NODE_OPTIONS=--no-experimental-webstorage` 后同一文件立即 4/4 绿。

**放大因素**：

- 仓内**没有** `.node-version` / `engines.node`；本机 mise 默认 `node 24.22.3` **不提供 pnpm** ⇒ 文档里的 `pnpm exec vp check` 直接失败（`mise ERROR pnpm is not provided by the active node@24.22.3`）。
- 三处版本不一致：CI `24.20.0` · release `24.18.0` · CI 注释写「本地为 v24.20.0」（实测为 24.22.x）。

**验收口径（派单用）**：`.node-version` 与 `engines.node` 存在且与 CI 一致；CI 与 release 用同一版本并删掉过时注释；在「正确版本」和「故意跑在 Node 26」两种环境下，`vp test --run` 的数字必须可解释（前者 0 红；后者若仍红，必须在 README 写明本仓要求的 Node 版本，或补 vitest `localStorage` 兜底让两者都绿）。

## 三、P2 · 死依赖与死代码

**3.1 声明未使用的依赖（全仓 0 引用，`git grep -F` 逐条核实）**

`moment`（两个日期库并存：`dayjs` 77 处引用 / `moment` 0 处）· `markdown-it` + `@types/markdown-it` · `@types/validator` · `@vue/tsconfig`（实际用 `@tsconfig/node20`）· `@configurajs/vite-plus` · `@rushstack/eslint-patch` · `cross-env` · `font-slice`（仅出现在生成物 CSS 注释里）· `nue-ui-resolver`。

**3.2 死组件：`apps/web/src/components/app/aside/**`**

- 生产零引用（`views/index/index.vue` 用的是 `<app-aside-v2-adapter />`）；`app/index.ts` 仍 `export * from './aside'`。
- **但两个测试仍挂载它**：`app/__tests__/t603-nav-a11y.test.ts`（主导航 4 项 a11y）与 `app/__tests__/t633-ac1-route-icon-class.test.ts`（路由图标双主题类）⇒ 断言验的是用户看不到的组件，属**假保险**。
- 处理原则：**先重定向到 `aside-v2` 再删**（不得先删测试以免丢失覆盖）；若 `aside-v2` 不满足原断言，**不得放宽断言**，按真实缺陷上报。

**3.3 死配置：`VITE_SHOW_UNIMPLEMENTED_FEATURES`**

`apps/web/src/env.ts` 定义 + `apps/web/.env.development` / `.env.production` 写入，全仓 0 处消费。

**3.4 误导性字段**

root `package.json` 的 `"workspaces": ["packages/*"]` 是 npm 遗留，与 `pnpm-workspace.yaml`（`apps/*` + `packages/*`）不一致；pnpm 不读它，但会让读者误判工作区范围。

**3.5 观察（不计为缺陷，供架构决策）**

`apps/web` 不声明任何第三方依赖（`vue` / `pinia` / `dexie` / `axios` 全靠根 hoisting）⇒ phantom dependency，pnpm 严格布局或换包管理器即炸。改动面大（需要逐包补声明 + 验证 hoisting 行为），本批**不做**。

## 四、P3 · 卫生

- 生产代码里的调试日志 2 处：`apps/web/src/components/tasks/built-in-project/main/index.vue:101`（`console.log(createTaskOptions)`）· `packages/shared/hooks/use-subscriber.ts:67`（每次事件 `emit` 都打）。构建已 `terser drop_console:['log']`，故只污染 dev 控制台。
- 注释掉的 `console.log` 12 处（噪声，无功能影响）。
- 本地构建产物 `apps/web/stats.html`（824 KB）· `apps/desktop/stats.html`（833 KB）：已在 `.gitignore`，未入库，仅占磁盘。
- `docs/tasks-state.md` 已达 896 行，与本文件自述「保持精简、已终签批次只留一行」冲突（仍保留 2026-09 起的整段批次史）。
- 运行期文档引用失效：`tasks-state` 31 处 · `defect-pool` 7 处（历史 ADR/PRD 内的失效引用不追）。

## 五、分派

- **rd-infra**：§二（Node 锁定 + CI/release 对齐）· §三.1（依赖清理）· §三.4。
- **rd-fe**：§三.2（死组件 + 两个测试重定向）· §三.3（死配置）· §四（两处 `console.log` + 注释行）。
- **qa**：独立复验（重定向后的断言是否真挂 `aside-v2`、删除依赖后构建/安装是否成立、Node 版本判据的可复算性）。
- **PM**：§四 台账压缩 · 本报告 · 收口与发版决策。