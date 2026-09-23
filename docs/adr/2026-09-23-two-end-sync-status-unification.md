# 2026-09-23 两端一致的同步状态展示（T115：组件落点 / web 数据映射 / 删除边界）

- **评审对象**：T115（用户实测反馈 #1：① 删掉 web 内容区顶部「已更新」同步信息面；② web 改用与 Desktop 一致、位于左下角的同步状态组件）
- **结论**：⚠️ **有条件可行** —— 用户口径成立且可落地；但 **PM 输入信封中 4 处落点事实需更正**（§0），且「desktop 行为逐字不变」与「删面」**在字面上不可同时成立**（顶部面是两端共用代码）⇒ 该不变量须按下表精确化（§4）。落地方案见 §1–§3，**DP-1…DP-5 待 PM 拍板**（§7）。
- **范围**：`apps/web/src/components/offline/offline-status.vue`（内容区状态条）+ `apps/desktop/src/renderer/src/components/sync-status-bar.vue` + `apps/desktop/src/renderer/src/hooks/{use-sync-status,use-manual-sync}.ts` + `apps/web/src/views/index/index.vue`（挂载点）+ `apps/web/src/hooks/index.ts`
- **代码边界**：本 ADR 为**纯文档产出**，评审方**未修改任何仓库代码**（只读评审 + codegraph 影响面）
- **前序**：`docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md`（C1–C16）、`docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 / C-60 / C-66）
- **PRD 依据**：`docs/prds/2026-09-23-web-offline-stage1.md`（AC8 / AC9 / AC10 / AC13b）、`docs/prds/2026-09-10-desktop-sync-status-rail-merge.md`（AC-01…AC-14）
- **影响面工具**：codegraph（`apps/desktop/src/renderer/src/AppRoot.vue` 2 callers；`useSyncStatus` / `useManualSync` 各 1 caller；测试引用 `sync-status-bar.test.ts` / `AppRoot.test.ts` / `def10-bootstrap-order.test.ts`）

---

## 0. 事实核对：PM 输入信封的 4 处更正（均为读码核实，非推断）

| #      | PM 原述                                                    | 核实结果                                                                                                                                                                                                                                                                                                                                     | 证据                                                                                                                                                                                                                                                                                                  |
| :----- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | `offline-status.vue` = **web 独有**                        | ❌ **错**。它是**两端共用**代码：desktop 经 `@` 别名复用 webapp 的 `App.vue` / `router` / `views/index/index.vue` ⇒ 桌面端**同样**渲染该条                                                                                                                                                                                                   | `apps/desktop/src/renderer/src/AppRoot.vue:2`（`import App from '@/App.vue'`）、`apps/desktop/src/renderer/src/main.ts:8`（`import router from '@/router'`）→ `apps/web/src/router.ts:3` → `apps/web/src/views/index/routes.ts:7` → `apps/web/src/views/index/index.vue:5,31`（`<offline-status />`） |
| **P2** | `offline-status.vue` 承载 **AC10 / C-59 只读闸门可见提示** | ❌ **错**。只读提示是**独立组件** `OfflineReadOnlyBanner`（`packages/presentation/offline/read-only-banner.vue`，i18n `offline.readOnlyBanner`），由 `index.vue:7,29` 单独挂载 ⇒ **本次删除边界不涉及 AC10**（除非另行决定删它，本设计不删）                                                                                                 | `apps/web/src/views/index/index.vue:7,29`；`packages/presentation/offline/read-only-banner.vue:16,20`                                                                                                                                                                                                 |
| **P3** | 触顶 N 文案对应 **AC10**                                   | ❌ **错**。对应 **AC13b**（+ PRD 范围⑤「覆盖度/触顶提示」+ ADR 护栏 B「截断时 `mirrorPulledAt` 不得推进 + 触顶提示」）                                                                                                                                                                                                                       | `docs/prds/2026-09-23-web-offline-stage1.md:115`（AC13b）、`:46`（范围⑤）；`docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md:372`                                                                                                                                                  |
| **P4** | （PRD 边界③ / ADR Z12）「web 上 `lastSyncAt` 恒 `null`」   | ⚠️ **已过时**：C-66 后 web 已接同一 `syncService`，`lastSyncAt` **会**推进。但 **仍不得**作 web 新鲜度：`endRun` 仅在 `lastError === null` 时推进（**截断不报错 ⇒ 会推进**），且**内存态不落盘**（冷启动归 `null`）⇒ 用它会把「未拉完」谎报成「已同步」。故 web 面板时间**必须**取 `mirrorPulledAt`（仅完整拉取推进 + 落盘 `meta`，C-60 r5） | `packages/infrastructure/src/persistence-sync/sync-status.ts:191-197`（`if (lastError === null) partial.lastSyncAt = …`）、`:155-160`（`markMirrorPulled` / `markMirrorTruncated`）、`:178`（`restoreMirrorStatus`）                                                                                  |

**P1 的连带后果（本单最关键的约束冲突）**：用户口径是「删掉 **web** 内容区顶部的面」，但该面**同时出现在 desktop**（desktop 当前 = 顶部面 + 左下角面板 **双份**）。因此：

- 「删面」必然**同时**改变 desktop 的可见结果（除非加端门控）；
- PM 的「**desktop 行为逐字不变**」在字面上**与「删面」互斥** ⇒ 见 **DP-1**。

---

## 1. D-1 裁决：组件落点 = **迁入 webapp，两端经既有装配缝引用**（采纳 PM 方向）

**落点**：

| 产物          | 现位置                                                             | 目标位置                                                                                                                                                                                                  |
| :------------ | :----------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同步状态组件  | `apps/desktop/src/renderer/src/components/sync-status-bar.vue`     | `apps/web/src/components/sync/sync-status-bar.vue`                                                                                                                                                        |
| 状态 hook     | `apps/desktop/src/renderer/src/hooks/use-sync-status.ts`           | `apps/web/src/hooks/use-sync-status.ts`                                                                                                                                                                   |
| 手动同步 hook | `apps/desktop/src/renderer/src/hooks/use-manual-sync.ts`           | `apps/web/src/hooks/use-manual-sync.ts`                                                                                                                                                                   |
| 组件测试      | `apps/desktop/src/renderer/src/components/sync-status-bar.test.ts` | `apps/web/src/components/sync/__tests__/sync-status-bar.test.ts`                                                                                                                                          |
| web 挂载点    | —（无）                                                            | **新增 web-only 根** `apps/web/src/WebRoot.vue`（= `<App />` + `<SyncStatusBar :sync-time-source="'mirrorPulledAt'" />`），由 `apps/web/src/main.ts` 挂载（`AC16b` 已有「web-only 接线在 web 入口」先例） |
| desktop 引用  | `AppRoot.vue` 本地 import                                          | `import SyncStatusBar from '@/components/sync/sync-status-bar.vue'`（`@` = webapp）；**挂载位置/条件（`v-if="unlocked && gatePassed"`）不变**                                                             |

**理由**：

1. **消除反向依赖**（PM 已识别的缺陷）：现组件物理在 `apps/desktop/**`，若 web 引用即 `web → desktop`，与构建期装配缝方向相反。迁入 webapp 后依赖恒为 `desktop → webapp`。
2. **与既有模式完全一致**：该组件**已经在**消费 webapp 的 `@/components/app/aside-v2/rail-host`、`@/components/settings/dialog/state`（`sync-status-bar.vue:13-14`）⇒ 组件本身也已属「webapp 装配资产」，物理位置只是历史遗留。
3. **端差异的既有惯例是「webapp 提供、desktop 经 `@`/`@/hooks` 装配缝消费」**（`apps/desktop/electron.vite.config.ts:42-50` 别名；`apps/desktop/src/renderer/src/hooks/index.ts` 已 re-export webapp hooks）。
4. **一次性消除 SHELL-02 R9 的 `@/hooks` 别名陷阱**：root vitest 的 `@` 别名 = `apps/web/src`（`vite.config.ts:9-11`）且**无** `@/hooks` 特例；组件迁入 webapp 后其 `import { … } from '@/hooks'` 与 root 别名**天然一致**，测试里的 `vi.mock('@/hooks')` 不再是「隔离装配层的权宜手段」（`sync-status-bar.test.ts:27-28` 的注释可退役）。

**必须同时做的连带（否则 desktop 构建断链）**：desktop 的 `@/hooks` 别名**优先于** `@`（`electron.vite.config.ts:44-46`）⇒ 迁入 webapp 的组件在 **desktop 构建**下 `@/hooks` 解析到 **desktop** hooks。故 `apps/desktop/src/renderer/src/hooks/index.ts` 必须把原 `export * from './use-sync-status'` / `'./use-manual-sync'` 改为 re-export webapp 文件（与该文件已有的 `@nao-todo/webapp/src/hooks/use-auto-change-theme` 等**同形**），并删除 desktop 侧两个已迁走的文件。

**对 SHELL-02 C1–C16 的影响面**：**行为约束全部继续有效，无需改条款**。需修订的只是**落点与口径描述**（⇒ 新 ADR 落盘时在 SHELL-02「变更管理」互记一行，见 §5）：

| SHELL-02 条目                                                              | 影响                                                                                             | 处理                                          |
| :------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| D-1（§2）「webapp colocate `rail-host`」                                   | 结论不变，需补一句「消费组件本身亦 colocate 于 webapp」                                          | 修订（r6）                                    |
| C1–C5（元素目标 Teleport / 禁轮询 / 无回落 / 注册表置位 / 宿主缺失不渲染） | **不变**                                                                                         | 无                                            |
| C6′–C8″（nue-ui 两版等价子集）                                             | **不变**，且**获益**：组件迁入 webapp 后 web 生产构建跑 `nue-ui@1.11.0`，该组合在 D-4 已实测等价 | 无（补注）                                    |
| C9/C10（r5 内容常驻 + 断言口径）、C11–C16                                  | **不变**                                                                                         | 无                                            |
| §4 证据索引（引用 `sync-status-bar.vue:82-85` 旧行号）                     | 行号失效                                                                                         | 修订（r6，改路径+新行号或改「路径稳定引用」） |
| §6 AC-13「web 端侧栏零可见变化」                                           | ❌ **失效**：web 现在**会**渲染该组件                                                            | 修订（r6）+ 通知 PM/QA                        |
| §7 R8（desktop 1.10.58 / web 1.11.0 双副本）                               | 不变（仍双副本），但本组件已双端实测等价                                                         | 补注                                          |
| §7 R9（`@/hooks` 别名）                                                    | **对本组件失效**（已迁入 webapp）                                                                | 补注                                          |
| §5 skill 偏离（原生 `<li>` + footer 按钮）                                 | **不变**（两端沿用）                                                                             | 无                                            |

---

## 2. D-2 裁决：web 侧数据映射 = **同一组件、同一状态接口、单一来源开关**

**裁定**：**同一组件同一状态接口**（否决「web 只读变体」）。

**否决只读变体的理由**：

1. 该组件的价值与风险**全在 C1–C16 的细节**（元素目标 Teleport、`transparent:true`、池激活、`aria-expanded`、`@close`+`nextTick` 焦点归还、`<li>` 合法性、skill 偏离留痕）。**复制一份 = 把这些约束复制两份**，任一侧改 nue-ui 行为即产生永久漂移，且 QA 要维护两套断言。
2. web 需要的字段是 desktop 的**真子集**（无 push 队列 ⇒ 3 个字段恒 0/false），**不需要新接口**。
3. 「两端一致」的**唯一**含义就是同一份实现 + 同一份状态语义；变体天然破坏该目标。

**web 侧等价语义定义（逐字段，含证据）**：

| 面板字段       | desktop 语义与来源                           | **web 等价语义**                                                  | web 来源                        | 依据                                                                                                           |
| :------------- | :------------------------------------------- | :---------------------------------------------------------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------- |
| `syncing`      | 拉取/推送执行中                              | **同义**（web 亦跑 `pullAllInner`）                               | `syncStatus.syncing`            | 同一 `syncService`（C-66）                                                                                     |
| 首行时间       | `lastSyncAt`（上次**完全成功**运行；内存态） | **上次完整拉取时间**（「数据截至」的同义量）                      | **`syncStatus.mirrorPulledAt`** | P4：`lastSyncAt` 在截断时**会**推进且不落盘 ⇒ 会谎报；`mirrorPulledAt` 仅完整拉取推进 + 落盘 `meta`（C-60 r5） |
| `pendingCount` | `syncQueue` 待推送数                         | **N/A ≡ 0**（web `markDirty` 恒 0 ⇒ 队列恒空）                    | 常量 0                          | C-59（r5）：web 不得新增本地写路径 ⇒ 队列恒空；既有 `v-if="pendingCount > 0"` 自动隐藏                         |
| `failedCount`  | `retryCount > 0` 的实体数                    | **N/A ≡ 0**                                                       | 常量 0                          | 同上                                                                                                           |
| `paused`       | SHELL-06 C-41（离线/超限**推送**暂停）       | **N/A ≡ false**（无推送 ⇒ 无暂停）                                | 常量 false                      | 同上                                                                                                           |
| `lastError`    | 本次运行首个错误                             | **同义且是新增价值**（web 当前**无**同步错误可见面）              | `syncStatus.lastError`          | 同一运行边界                                                                                                   |
| 「立即同步」   | `syncService.manualSync()`（先拉后推）       | **同 API**；web 推送为空操作 ⇒ 语义 = **「立即拉取 / 刷新镜像」** | 同一 `useManualSync`            | `sync-service.ts:1015-1027`                                                                                    |
| 离线/新鲜度    | desktop：只读 banner + 顶部状态条            | web：只读 banner + 警告条（②③，见 §3）                            | `useReadOnlyState`              | C-59                                                                                                           |

**接口形态（单一来源开关，默认值 = desktop 现行为）**：

```text
props: {
  // 首行时间的来源：'lastSync'（desktop 默认，逐字不变）| 'mirrorPulledAt'（web）
  syncTimeSource?: 'lastSync' | 'mirrorPulledAt'
}
```

- desktop **不传** ⇒ 默认 `'lastSync'` ⇒ `lastSyncText` / `statusTheme` / `liveSummary` / 面板结构**逐字不变**（desktop 挂载点 `AppRoot.vue` 保持原样）；
- web 在**自己的挂载点**（`WebRoot.vue`）显式传 `'mirrorPulledAt'` ⇒ 仅首行取值来源变化，其余渲染分支（含 3 个恒空行的 `v-if`）**零改动**；
- **不引入**新的状态类型 / 新的 hook 分叉 / **共享视图内的端条件分支**（端差异只出现在**端自己的挂载点**）。

> 说明：不用「prop 传 `lastSyncAt` 值」而用「来源开关」，是为了避免 `null` 的**哨兵歧义**（web 的「从未拉取」必须仍落 `sync.neverSynced`，即 `null` 有意义）。

---

### 两端装配关系（组件与交互，T115 落点后）

```text
                       apps/web/src  (webapp = 单一真源)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ hooks/index.ts ── exports ──► use-sync-status.ts  use-manual-sync.ts  │
  │ components/sync/sync-status-bar.vue ── imports ──► @/hooks            │
  │        │  └─ imports ──► @/components/app/aside-v2/rail-host (宿主注册表)
  │        │  └─ imports ──► @/components/settings/dialog/state (C11 收起)
  │        └─ Teleport(v-if railBottomHost) ──► aside-v2 70px 轨道底部（齿轮上方）
  │ views/index/index.vue ── mounts ──► <offline-status/>（内容区告警条，仅 ②③/F/G）
  └──────────────────────────────────────────────────────────────────────┘
        ▲                                            ▲
        │ desktop build: `@`→webapp, `@/hooks`→desktop hooks (re-export webapp)
        │                                    │
  apps/desktop/src/renderer/src/AppRoot.vue（挂载位置/条件不变，仅 import 路径变）
  apps/desktop/src/renderer/src/hooks/index.ts（改为 re-export webapp 两 hook）

  数据来源：syncStatus（infrastructure 单例，两端同一实例语义）
    desktop: syncTimeSource='lastSync'      (默认，逐字不变)
    web:     syncTimeSource='mirrorPulledAt' (C-60 r5 落盘值)

  apps/web/src/main.ts ──► WebRoot.vue（web-only 根）= <App/> + <SyncStatusBar sync-time-source="mirrorPulledAt"/>
```

## 3. D-3 裁决：删除边界逐条清单（含 AC 映射与满足方式）

`offline-status.vue` 的信息项**穷尽枚举**（7 条文案 + 3 项结构）：

| #     | 信息项（i18n 键）                                  | 文案                                                      | 判定                       | 归属类别                         | 对应 AC / 条款                                              | 删除/迁移后**如何仍被满足**                                                                                          |
| :---- | :------------------------------------------------- | :-------------------------------------------------------- | :------------------------- | :------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **E** | `offline.freshness.updated`                        | 「已更新」                                                | **删除渲染**               | 同步信息（在线常驻噪声）         | C-60 ①（**条款须修订**，见 §5）                             | 在线态改由左下角面板首行「上次同步 {time}」承载（web 取 `mirrorPulledAt`）；**文案键保留**（可回滚），仅取消常驻渲染 |
| **C** | `offline.freshness.mirror`                         | 「离线模式 · 数据截至 {time}」                            | **保留原位**（不迁入面板） | 同步信息 **∩ 数据可信度告警**    | **AC8**（`docs/prds/2026-09-23-web-offline-stage1.md:109`） | 原样保留在内容区；仍由 `formatMirrorPulledAt` 保证无 `null`/`Invalid Date`/1970（负向断言继续有效）                  |
| **D** | `offline.freshness.mirrorHint`                     | 「可能不是最新」                                          | **保留原位**               | 同上                             | **AC8**                                                     | 同上（与 C 同分支）                                                                                                  |
| **A** | `offline.freshness.incomplete`                     | 「尚未同步完成，数据可能不完整」                          | **保留原位**               | 同步信息 **∩ 数据可信度告警**    | **AC9**（`:110`）、C-60 ③                                   | 原样保留；`mirrorPulledAt` 非法/截断 ⇒ 落 ③（不显示「截至」）                                                        |
| **B** | `offline.freshness.incompleteHint`                 | 「请连接网络后重试」                                      | **保留原位**               | 同上（**引导联网**）             | **AC9**（「引导联网，不得呈现为数据丢失」）                 | 同上（与 A 同分支）                                                                                                  |
| **F** | `offline.coverage.loadingMore`                     | 「正在加载更多…」                                         | **保留原位**               | 操作反馈（瞬态进度）             | PRD 范围⑤；`coverage.ts` 设计约束（两条**独立**、不合并）   | 原样保留；面板轨道按钮的 `:loading` 为**另一处**指示，二者不互替（一处在内容旁、一处在轨道）                         |
| **G** | `offline.coverage.truncated` / `.truncatedGeneric` | 「已加载 N 条，仍有更多未加载」/「任务数量超过同步上限…」 | **保留原位**               | **覆盖度告警**（数据可能不完整） | **AC13b**（`:115`）+ PRD 范围⑤ + ADR 护栏 B（`:372`）       | 原样保留；N 仍取 `countMirrorRows` 实际行数、取不到退通用文案（不编造数字）                                          |
| 结构  | `role="status"` + `aria-live="polite"`             | —                                                         | **保留**                   | 可访问性                         | SHELL-02 同源 NFR（读屏摘要）                               | 不变                                                                                                                 |
| 结构  | `.is-alert` 警示底色                               | —                                                         | **保留**                   | —                                | —                                                           | 不变                                                                                                                 |
| 结构  | 根节点常驻渲染                                     | —                                                         | **改为条件渲染**（见下）   | —                                | 用户口径①                                                   | `v-if` 门控：无话可说时**整个条不渲染**（这才是用户要的「删面」）                                                    |

**「删面」的精确落法（唯一必要的行为改动）**：

```text
渲染条件 = freshness !== 'updated' || coverage.loadingMore || coverage.truncated
```

即：**在线且数据完整且无进行中拉取 ⇒ 内容区顶部不再出现任何条**（用户口径①达成）；一旦离线/未拉完/触顶/正在加载 ⇒ 条以现有形态出现（AC8/AC9/AC13b 的可见性**零降级**）。

**为什么 A–D、F、G 不迁入左下角面板**：

1. **AC8/AC9 的 Then 是「显示」**——把「数据可能不是最新 / 不完整」藏进**默认收起**的下拉面板，等于把**数据可信度告警**降级为「点开才可见」，是 UX 与可验收性的双重倒退（QA 的 `offline-status.test.ts` 也会失去其内容区断言锚点）。
2. PM 原则「**操作反馈保留**」的**正确外延**包含「关于**正在阅读的数据**的可信度反馈」；只读提示（AC10）已由独立组件承担，若再抽走 A–D，内容区将只剩无告警的列表。
3. 「同步信息去重」的**真实冗余只有 ①**：在线时顶部「已更新」与轨道图标常态色/面板首行**说的是同一件事**；②③ 与面板首行（时间）粒度不同（**告警 vs 状态**），不构成冗余。

> **不否决 PM 提议**，但**收窄其定义**：「去重」= 删除 ① 的常驻渲染；**不等于**删除 ②③ 与覆盖度提示（后者是 AC8/AC9/AC13b 的可见输出）。

---

## 4. 不变量（可勾选）

- [ ] **desktop 行为不变**（精确口径，见 DP-1）：除「① 在线『已更新』条不再常驻渲染」这一**用户口径要求的变化**外，desktop 的轨道按钮/面板结构、C1–C16 全部行为、`aria-live` 摘要、焦点归还、几何（AC-01/02/07/11）**逐字不变**。
- [ ] **C-60 的 ②③ 文案与判定保持「互斥穷尽」且渲染点唯一**（仍是 `offline-status.vue`；不新增第二处）。
- [ ] **AC10 / C-59 只读可见提示不受影响**（`OfflineReadOnlyBanner` 未触碰）。
- [ ] **web 不得因本单新增任何本地写路径**（C-59 r5；本设计只读 `syncStatus` + 调既有 `manualSync()`）。
- [ ] **移动端红线**：`packages/presentation-react`、`apps/mobileapp` **零改动**（`git status --porcelain -- packages/presentation-react apps/mobileapp` = 0）。本设计不触碰 `packages/presentation/offline`（只读使用）。
- [ ] **服务端契约零改动**（无分页/排序/字段变更）。
- [ ] **i18n 三处一致**：不新增/不删除键（`offline.freshness.updated` **保留**）⇒ `zh-CN` / `en-US` / `types.ts` 无需联动。

### NFR 分析（本单相关项，全部**沿用** SHELL-02 已实测结论，不引入新指标）

| NFR                 | 目标（可量化/可监控）                                                                                                                             | 本单是否触及                                                                          | 依据/验证                                                                        |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------- |
| 零 layout shift     | 轨道按钮/齿轮 rect **开合前后逐位一致**；注入点 `display:contents` 不贡献 gap                                                                     | **不触及**（web 新增装配 = desktop 已验证的同一条路径）                               | SHELL-02 AC-02/AC-13；`aside-v2.css` `.aside-rail-bottom-slot{display:contents}` |
| 无无界定时器/无轮询 | 我方代码 **0 定时器**、0 `setInterval`/`MutationObserver`；库内监听**打开注册/关闭断开**                                                          | **不触及**（未新增任何监听；web 复用同一实现）                                        | SHELL-02 C2/R14                                                                  |
| 可访问性            | 轨道按钮 `aria-label`(i18n) + `aria-expanded`；`Tab`→`Enter` 可达 footer；`Esc` 关闭后焦点归还；`aria-live` **只播摘要**（不含 `lastError` 全文） | **不触及**（C13/C16/NFR 全部保留）；web 新增的 `syncTimeSource` 不改变 DOM 结构       | SHELL-02 AC-03/AC-12                                                             |
| 内容区可读性        | 在线且数据完整 ⇒ 顶部条**不渲染**（0 像素占用）；告警时 ≤2 行 xs 文本                                                                             | **改善**（删除常驻噪声）                                                              | 本 ADR §3；`offline-status.vue` 现有样式不变                                     |
| 数据可信度          | 新鲜度**不得谎报**：`mirrorPulledAt` 仅在完整拉取时推进；非法值落 ③ 且不渲染时间                                                                  | **强化**（web 面板首行改用 `mirrorPulledAt`，消除 `lastSyncAt` 在截断时推进的谎报面） | C-60 r2/r5；`sync-status.ts:191-197` vs `:155-160`                               |
| 性能                | 面板/条均为纯渲染，无网络/DB 轮询；`useMirrorLoadedCount` 仅在 `mirrorTruncated` 时查库                                                           | **不触及**                                                                            | `use-mirror-loaded-count.ts`（既有）                                             |

---

## 5. 连带同步清单（含 Owner）——本单**改变既有条款/口径**，必须同批落

| #   | 文档                                                                     | 需修订内容                                                                                                                                                                                                                                                                   | Owner                                |
| :-- | :----------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| S1  | `docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md`              | **r6**：① §2 D-1 补「消费组件亦 colocate 于 webapp」；② §4 证据索引路径/行号改为新落点；③ §6 **AC-13 口径修订**（web 不再「零可见变化」，改为「web 装配同一组件，差异仅在数据来源 `syncTimeSource`」）；④ §7 R8/R9 补注（R9 对本组件失效）；⑤ §10 变更管理互记一行指向本 ADR | **arch**                             |
| S2  | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`    | **r6**：① **C-60 ①「已更新」渲染退役**（文案键保留；②③ 不变、渲染点仍唯一）；② AC8/AC9 的**可测性口径**补「渲染点 = `offline-status.vue`，在线且无告警时整条不渲染」；③ §11 变更记录互记一行指向本 ADR                                                                       | **arch**（+ PM 确认 C-60① 退役措辞） |
| S3  | `docs/prds/2026-09-23-web-offline-stage1.md`                             | ① 边界③ 中「web 上 `lastSyncAt` 恒 `null`」**已过时**（P4）⇒ 改为「web 新鲜度**必须**取 `mirrorPulledAt`（`lastSyncAt` 在截断时会推进 ⇒ 谎报）」；② 范围⑤ 补「覆盖度/触顶提示**常驻内容区**」；③ 登记「在线态不再常驻显示『已更新』」                                        | **PM**                               |
| S4  | `docs/prds/2026-09-10-desktop-sync-status-rail-merge.md`                 | **AC-13**「web 端侧栏零可见变化」口径修订（web 现装配该组件）                                                                                                                                                                                                                | **PM**                               |
| S5  | `docs/adr/README.md`                                                     | 新增本 ADR 索引行 + 篇间关系（本 ADR ↔ SHELL-02 / WEB-OFFLINE）+ 待拍板跟踪（DP-1…DP-5）                                                                                                                                                                                     | **arch**                             |
| S6  | `docs/tasks-state.md`                                                    | T115 状态与落点（组件迁入 webapp + 挂载点 + 数据来源开关）                                                                                                                                                                                                                   | **PM**                               |
| S7  | 测试：`apps/web/src/components/offline/__tests__/offline-status.test.ts` | 用例 it#3「在线 ⇒『已更新』且不显示时间」**必须改写**为「在线且无告警 ⇒ **不渲染任何条**（`wrapper.find('.offline-status').exists() === false`）」；其余 5 例保持                                                                                                            | **RD（T115b）**                      |
| S8  | 测试：`sync-status-bar.test.ts` 随组件迁入 webapp                        | 4 例保持；`vi.mock('@/hooks')` 注释（R9 权宜）退役；补 1 例覆盖 `syncTimeSource='mirrorPulledAt'`                                                                                                                                                                            | **RD（T115b）**                      |
| S9  | 挂载点（**DP-2 = B**）                                                   | 新增 `apps/web/src/WebRoot.vue`（`<App />` + `<SyncStatusBar :sync-time-source="'mirrorPulledAt'" />`）；`apps/web/src/main.ts` 改挂 `WebRoot`；**desktop `AppRoot.vue` 仅改 import 路径**（挂载位置/条件不变）                                                              | **RD（T115b）**                      |
| S10 | 全范围门禁复跑 + desktop Electron 冒烟（轨道几何 AC-01/02/07/11）        | 逐项给数字/退出码                                                                                                                                                                                                                                                            | **RD/QA**                            |

---

## 6. 风险清单（含应对）

| #   | 风险                                                                                                                                   | 影响                                                | 应对                                                                                                                                                                         |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | **窄屏 web（≤445px）无轨道宿主**：抽屉分支不绑定 `railBottomHost`（`aside-v2-drawer.vue` 无 rail-host import）⇒ 同步面板**整体不渲染** | 手机宽度下 web 无同步状态面板（无「立即同步」入口） | AC8/AC9/AC13b 仍由内容区警告条满足；只读提示仍可见 ⇒ **能力缺口可接受**。若 PM 判为缺口 ⇒ 另开单（抽屉内注入点），**不在本单扩范围**（见 DP-4）                              |
| R-2 | desktop 与 web 的 `nue-ui` 版本不同（1.10.58 / 1.11.0）                                                                                | 组件在 web 首次以生产路径跑 1.11.0                  | SHELL-02 D-4 已实测两版等价（C6′–C8″）；本单只增一条生产路径，**无新 API** ⇒ 风险低。QA 侧以 web 冒烟覆盖                                                                    |
| R-3 | web 新增 web-only 根（`WebRoot.vue`）改变 web 的根组件层级                                                                             | 需回归 web 启动/路由/主题/多标签广播等根级接线      | 该根仅包一层：`<App />` + 一个 Teleport 组件（宿主缺失即不渲染）⇒ 对路由/`installGlobalErrorObservability`/`installSignOutBroadcastListener` **零影响**；web 冒烟覆盖（S10） |
| R-4 | ① 退役后，在线态**无任何**「数据是新的」指示                                                                                           | 用户可能不确定数据是否最新                          | 轨道按钮常态色 + 面板首行「上次同步 {time}」= 一次点击可达；且在线态**不是**用户投诉的对象以外的信息（用户主动要求删）                                                       |
| R-5 | `syncTimeSource` 被误用（web 传 `lastSync`）                                                                                           | 截断时谎报新鲜度                                    | 默认值 = desktop 行为；**web 挂载点必须显式传 `'mirrorPulledAt'`** ⇒ 加单测（S8）锁死；ADR 与 PRD 双处留痕                                                                   |
| R-6 | `offline.freshness.updated` 成为**无渲染点的键**                                                                                       | 轻微死代码                                          | **保留**（零成本、可回滚、避免动 3 处 locales + types 的联动门禁）；若 PM 确认永久退役 ⇒ 另开清理单                                                                          |

---

## 7. 待拍板决策点（trade-off，**不替 PM 拍板**）

| ID       | 议题                                                                                    | 选项                                                                                                                                                                                                                                                                                                               | arch 建议                                                                                                                                                                                                                                                               |
| :------- | :-------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DP-1** | 顶部面是**两端共用**（P1）⇒ 「删面」必然波及 desktop。PM 的「desktop 逐字不变」须精确化 | **A. 两端生效**（仅 ① 在线条消失；②③ 与覆盖度提示保留）——**须用户/PM 知情：desktop 的在线『已更新』条也会消失** <br>**B. 端门控**（`env.appType === 'web'` 才删/才不渲染）——desktop 逐字不变，代价：**共用视图里出现端条件分支**，且 desktop 保留双份信息                                                          | **A**（用户口径是「去重」，desktop 同样冗余；B 在共用视图引入端分支，与「webapp 单一真源」原则相悖）。⚠️ 附注：`env.appType` 全仓**当前 0 处使用**（仅 `env.ts` 声明），若选 B **必须先验证 desktop 构建确注入 `VITE_APP_TYPE=desktop`**（`.env.*` 已就位但无使用先例） |
| **DP-2** | 挂载点（避免 desktop 双份渲染；同时决定 `syncTimeSource` 在哪端赋值）                   | **B. 端各自挂载点**：web 新增 web-only 根 `WebRoot.vue`（显式传 `'mirrorPulledAt'`），desktop `AppRoot.vue` **仅改 import 路径**（默认 `'lastSync'`）<br>**A. 单一挂载点**：两端均由 `views/index/index.vue` 挂载、`AppRoot.vue` 撤挂载；端差异须额外经 `@/hooks` 装配缝常量注入（共享视图内出现端差异，代价更高） | **B**（端差异落在**端自己的挂载点** = 既有分层；desktop 除 import 路径外**零改动**，最符合 PM 不变量；代价 = 新增 1 个 web-only 根文件）                                                                                                                                |
| **DP-3** | A–D / F / G 是否迁入左下角面板                                                          | **A. 保留原位**（仅 ① 删） <br>**B. 全量迁入面板**                                                                                                                                                                                                                                                                 | **A**（B 会把 AC8/AC9/AC13b 的可见输出降级为「点开才见」；且 `resolveFreshness`/`resolveCoverageHints` 的 C-60 互斥穷尽渲染点会分裂）                                                                                                                                   |
| **DP-4** | 窄屏 web（≤445px）无轨道宿主 ⇒ 无同步面板                                               | **A. 接受**（警告条 + 只读提示仍在） <br>**B. 本单补抽屉注入点**                                                                                                                                                                                                                                                   | **A**（本单是「展示一致性」不是「移动端适配」；B 会扩到抽屉布局与 SHELL-02 C5 的宿主契约重评）                                                                                                                                                                          |
| **DP-5** | C-60 ① 「已更新」条款措辞                                                               | **A. 改为「在线态不常驻渲染；由面板首行承载」** <br>**B. 保留条款，仅在 web 端不渲染**                                                                                                                                                                                                                             | **A**（条款与实现一致；B 会让 desktop/web 语义分叉）                                                                                                                                                                                                                    |

---

## 8. 实施顺序（T115b，单写者；每步可独立验证）

| 步  | 动作                                                                                                                                              | 验证（可量化）                                                                                                                                                                                                                                |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | 迁移：组件 + 2 个 hook 进 webapp；desktop `hooks/index.ts` 改 re-export；`AppRoot.vue` 改 import 路径                                             | `pnpm exec vp check` = 0 error；desktop 构建 exit 0                                                                                                                                                                                           |
| 1   | 挂载点（DP-2=B）：新增 `apps/web/src/WebRoot.vue` + `main.ts` 改挂 `WebRoot`（显式传 `'mirrorPulledAt'`）；desktop `AppRoot.vue` 仅改 import 路径 | desktop Electron 冒烟：轨道按钮/齿轮几何与迁移前**逐位一致**（AC-01/02/07/11）；web 侧栏出现同一轨道按钮                                                                                                                                      |
| 2   | `offline-status.vue`：删 ① 分支 + 根 `v-if` 门控（§3）                                                                                            | `offline-status.test.ts` 6 例（it#3 改写后）全绿；在线无告警时 `.offline-status` 不存在                                                                                                                                                       |
| 3   | 测试迁移/补例（S7/S8）                                                                                                                            | 全仓 `pnpm exec vp test --run`：报**文件数/例数/红数**（须 0 红）                                                                                                                                                                             |
| 4   | 全范围门禁                                                                                                                                        | ① `pnpm exec vp check` 0 error；② 全仓 `vp test --run` 0 红；③ `pnpm run guard:ddd` exit 0；④ `pnpm exec vp run webapp build` + `pnpm run desktop:build` exit 0；⑤ `git status --porcelain -- packages/presentation-react apps/mobileapp` = 0 |

## 9. 变更管理

1. 本 ADR 为 T115 评审基线；实现期偏离 §1–§4 任一裁决 → 回到架构评审（口头同意不计）。
2. SHELL-02 的 **C1–C16 行为约束继续有效**；本 ADR 只修订其**落点/口径描述**（§1、§5-S1）。两篇冲突以**更晚落盘**者为准，且互记一行。
3. C-60 的 ②③ 与判定函数（`resolveFreshness` / `formatMirrorPulledAt`）**不得**在本次改动中被改写；仅 ① 的**渲染**退役（DP-5）。
4. 若 nue-ui 升级或 `rail-host` 契约变更 ⇒ 回到 SHELL-02 与本 ADR 重评。
5. 归档：本 ADR 落 `docs/adr/`，索引与篇间关系见 `docs/adr/README.md`；日期取评审终签日（2026-09-23）。