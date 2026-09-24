# 2026-09-23 两端一致的同步状态展示（T115/T115c：组件落点 / 数据映射 / 顶部零挂载 + 全部状态入面板）

- **评审对象**：T115（用户实测反馈 #1）→ **T115c（用户裁定变更设计：顶部零挂载 + 全部同步状态入状态组件）**
- **结论**：⚠️ **有条件可行** —— 用户裁定（顶部零挂载 + 全部状态入面板）**可落地**，但 **AC8 / AC9 / AC13b 的「零交互可见性」必须降级为「二段式可见性」**（§5 逐条论证 + 替代方案），且 **≤445px 抽屉分支会出现「完全无同步状态」的新缺口**（§5.4，必须裁定）。**PM 原 DP-1（两端生效 vs 端门控）与 DP-3（保留原位）已被用户裁定取代**（§3.1）。
- **追加范围（r8）**：用户裁定「**不要使用 banner，改为 `NueMessage` 或 `NueConfirm`**」⇒ 头部零挂载口径扩为 **`views/index/index.vue` 三个挂载点全部移除**（`offline-status` 迁入状态组件；`offline-read-only-banner` → **`NueMessage`**（写被拦截时）；`plaintext-notice-banner` → **`NueConfirm`**（一次性确认））⇒ **AC10 / AC17 的满足论证与验证方式随之改写**（§8）。
- **收口（r9，RD 已交付实证）**：**DP-7a / DP-7b 均已关闭** —— `read-only-banner.vue` + 其测试 + `OfflineReadOnlyBanner` 导出**已删除**（ADR 中以**历史/已删除**口径引用）；AC10 由**既有** `write-gate.notifyReadOnly()` 承担（**无需新增代码**）；AC17 的 `NueConfirm` 已在**真实 Chromium + CDP** 实测通过（单按钮、`nao.plaintextNoticeAck=1`、零 console warn/error）。**仍待落地**：`<offline-status />` 顶部挂载仍保留（等本 ADR §3–§6 面板设计落地后一并移除）。
- **范围**：`apps/web/src/components/offline/*`（内容区状态条及其 hooks）+ `apps/desktop/src/renderer/src/components/sync-status-bar.vue`（状态组件）+ `apps/desktop/src/renderer/src/hooks/{use-sync-status,use-manual-sync}.ts` + `apps/web/src/views/index/index.vue`（顶部挂载移除）+ 挂载点
- **代码边界**：本 ADR 为**纯文档产出**，评审方**未修改任何仓库代码**
- **前序**：`docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md`（C1–C16）、`docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 / C-60 / C-66）
- **PRD 依据**：`docs/prds/2026-09-23-web-offline-stage1.md`（AC8 / AC9 / AC10 / AC13b）、`docs/prds/2026-09-10-desktop-sync-status-rail-merge.md`（AC-01…AC-14）
- **用户原话（T115c，裁定依据）**：「那个加载中也不要了，就是**所有同步状态都在那个状态组件里面展示**，另外**不要在头部那一块地方挂载任何组件**，会**破坏内容区域可视情况（底部被遮住）**。」
- **影响面工具**：codegraph（`AppRoot.vue` 2 callers；`useSyncStatus`/`useManualSync` 各 1 caller；测试 `sync-status-bar.test.ts` / `AppRoot.test.ts` / `def10-bootstrap-order.test.ts`）

---

## 0. 事实核对：PM 输入信封的 4 处更正（读码核实，非推断）

| #      | PM 原述                                                    | 核实结果                                                                                                                                                                                                                                                                                           | 证据                                                                                                                                                                                                                                            |
| :----- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | `offline-status.vue` = **web 独有**                        | ❌ **错**。它是**两端共用**代码：desktop 经 `@` 别名复用 webapp 的 `App.vue` / `router` / `views/index/index.vue` ⇒ 桌面端**同样**渲染该条                                                                                                                                                         | `apps/desktop/src/renderer/src/AppRoot.vue:2`（`import App from '@/App.vue'`）、`main.ts:8`（`import router from '@/router'`）→ `apps/web/src/router.ts:3` → `apps/web/src/views/index/routes.ts:7` → `apps/web/src/views/index/index.vue:5,31` |
| **P2** | `offline-status.vue` 承载 **AC10 / C-59 只读闸门可见提示** | ❌ **错**。只读提示是**独立组件** `OfflineReadOnlyBanner`（`packages/presentation/offline/read-only-banner.vue`），由 `index.vue:7,29` 单独挂载 ⇒ 本次删除边界**不涉及 AC10**                                                                                                                      | `apps/web/src/views/index/index.vue:7,29`；`packages/presentation/offline/read-only-banner.vue:16,20`                                                                                                                                           |
| **P3** | 触顶 N 文案对应 **AC10**                                   | ❌ **错**。对应 **AC13b**（+ PRD 范围⑤ + ADR 护栏 B）                                                                                                                                                                                                                                              | `docs/prds/2026-09-23-web-offline-stage1.md:115`（AC13b）、`:46`（范围⑤）；`docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md:372`                                                                                            |
| **P4** | （PRD 边界③ / ADR Z12）「web 上 `lastSyncAt` 恒 `null`」   | ⚠️ **已过时**：C-66 后 web 已接同一 `syncService`，`lastSyncAt` **会**推进。但**仍不得**作 web 新鲜度：`endRun` 仅在 `lastError === null` 时推进（**截断不报错 ⇒ 会推进**），且**内存态不落盘**（冷启动归 `null`）⇒ 用它会把「未拉完」谎报成「已同步」。故 web 面板时间**必须**取 `mirrorPulledAt` | `packages/infrastructure/src/persistence-sync/sync-status.ts:191-197`、`:155-160`、`:178`                                                                                                                                                       |

**新增事实（T115c 追加核实）**：

| #      | 事实                                                                                                                                    | 证据                                                                                                                                                                                                         | 设计后果                                                                                                                                                     |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P5** | 内容区**顶部**共挂载 **3 个**组件：`plaintext-notice-banner`（AC17）、`offline-read-only-banner`（AC10/C-59）、`offline-status`（C-60） | `apps/web/src/views/index/index.vue:27,29,31`（均在 `<nue-content>` 内、`<router-view>` **之上**）                                                                                                           | 用户口径「不要在头部挂载**任何**组件」在字面上覆盖**全部 3 个** ⇒ 本单只处理 `offline-status`；**另两个记入待裁定（DP-7），不擅自处理**（PM 已上报其中一个） |
| **P6** | 抽屉分支（≤445px）**不绑定** `railBottomHost`                                                                                           | `apps/web/src/components/app/aside-v2/aside-v2-drawer.vue`（无 `rail-host` import）；`aside-v2.vue:60-66` 才有注入点                                                                                         | 顶部条移除后，**≤445px 将无任何同步状态可见**（现状有顶部条）⇒ 新缺口，§5.4 必须裁定                                                                         |
| **P7** | 面板所需数据**全部可从 shared 依赖取得**（无 web-only 接线依赖）                                                                        | `getMirrorState()` 只是 `syncStatus.get()` 的透传（`apps/web/src/data-plane.ts:81-84`）⇒ `mirrorPulledAt` / `mirrorTruncated` 直接取自 `useSyncStatus()`；`isReadOnly` 取自 `@nao-todo/presentation/offline` | 面板迁入 webapp 后**两端可用**，无需引入 `@/data-plane`（web 运行接线模块）⇒ 可行性成立                                                                      |
| **P8** | 面板根是库渲染的 `<ul>`，其直接子节点必须是 `<li>`                                                                                      | SHELL-02 §5 skill 偏离 + C12（`sync-status-bar.vue` 现有信息行/按钮均为 `<li>`）                                                                                                                             | `offline-status.vue` **不能**作为子组件原样嵌入（其根是 `<div>`）⇒ §6 处置 = **删除**                                                                        |

---

## 1. D-1 裁决：组件落点 = **迁入 webapp，两端经既有装配缝引用**（不变）

| 产物          | 现位置                                                             | 目标位置                                                                                                                                                                                                  |
| :------------ | :----------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同步状态组件  | `apps/desktop/src/renderer/src/components/sync-status-bar.vue`     | `apps/web/src/components/sync/sync-status-bar.vue`                                                                                                                                                        |
| 状态 hook     | `apps/desktop/src/renderer/src/hooks/use-sync-status.ts`           | `apps/web/src/hooks/use-sync-status.ts`                                                                                                                                                                   |
| 手动同步 hook | `apps/desktop/src/renderer/src/hooks/use-manual-sync.ts`           | `apps/web/src/hooks/use-manual-sync.ts`                                                                                                                                                                   |
| 触顶计数 hook | `apps/web/src/components/offline/use-mirror-loaded-count.ts`       | `apps/web/src/hooks/use-mirror-loaded-count.ts`（去掉 `@/data-plane` 依赖，见 §2.3）                                                                                                                      |
| 组件测试      | `apps/desktop/src/renderer/src/components/sync-status-bar.test.ts` | `apps/web/src/components/sync/__tests__/sync-status-bar.test.ts`                                                                                                                                          |
| web 挂载点    | —（无）                                                            | **新增 web-only 根** `apps/web/src/WebRoot.vue`（= `<App />` + `<SyncStatusBar :sync-time-source="'mirrorPulledAt'" />`），由 `apps/web/src/main.ts` 挂载（`AC16b` 已有「web-only 接线在 web 入口」先例） |
| desktop 引用  | `AppRoot.vue` 本地 import                                          | `import SyncStatusBar from '@/components/sync/sync-status-bar.vue'`（`@` = webapp）；**挂载位置/条件（`v-if="unlocked && gatePassed"`）不变**                                                             |
| 顶部挂载      | `index.vue:31` `<offline-status />`                                | **移除**（用户裁定；§3）                                                                                                                                                                                  |

**理由**（不变）：

1. **消除反向依赖**：现组件物理在 `apps/desktop/**`，web 引用即 `web → desktop`。迁入 webapp 后依赖恒为 `desktop → webapp`。
2. **与既有模式一致**：该组件**已经**在消费 webapp 的 `@/components/app/aside-v2/rail-host`、`@/components/settings/dialog/state`（`sync-status-bar.vue:13-14`）。
3. **端差异的既有惯例**是「webapp 提供、desktop 经 `@` / `@/hooks` 装配缝消费」。
4. **消除 SHELL-02 R9 的 `@/hooks` 别名陷阱**：root vitest `@` = `apps/web/src`（`vite.config.ts:9-11`）且无 `@/hooks` 特例；组件迁入后 `vi.mock('@/hooks')` 与 root 别名天然一致。
5. **必须连带**：desktop `@/hooks` 别名**优先于** `@`（`electron.vite.config.ts:44-46`）⇒ 迁入 webapp 的组件在 desktop 构建下 `@/hooks` 解析到 **desktop** hooks ⇒ `apps/desktop/src/renderer/src/hooks/index.ts` 必须把两个本地 export 改为 re-export webapp 文件（与既有 `@nao-todo/webapp/src/hooks/use-auto-change-theme` 同形），并删除 desktop 侧已迁走的文件。

**对 SHELL-02 C1–C16 的影响面**：**行为约束继续有效**；需修订的是落点/口径描述 + **AC-13**（见 §10-S1）：

| SHELL-02 条目                                                                 | 影响                                                                           | 处理                                                |
| :---------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :-------------------------------------------------- |
| D-1（§2）「webapp colocate `rail-host`」                                      | 补「消费组件本身亦 colocate 于 webapp」                                        | 修订（r6）                                          |
| **C5 / AC-08**「≤445px 抽屉 / 非 index 路由 / `profile` 未就绪 ⇒ 整体不渲染」 | **语义可能须修订**：顶部条移除后「抽屉 ⇒ 不渲染」= 「窄屏无任何同步状态」      | **待 DP-6 裁定**；若取「抽屉也注入」⇒ C5/AC-08 修订 |
| C1–C4、C6′–C8″、C9/C10、C11–C16                                               | **不变**（C6′–C8″ 且获益：web 生产构建跑 `nue-ui@1.11.0`，D-4 已实测两版等价） | 无                                                  |
| **C14 / D2 三态着色**（同步中 > 失败 > 待推送 > 常态）                        | **逐字不变**（新增状态**不插入颜色通道**，另开正交通道 —— §4）                 | 无（补注正交通道）                                  |
| §4 证据索引（旧行号）                                                         | 行号失效                                                                       | 修订（r6）                                          |
| **§6 AC-13「web 端侧栏零可见变化」**                                          | ❌ **失效**：web 现在**会**渲染该组件                                          | 修订（r6）+ 通知 PM/QA                              |
| §7 R8（双 nue-ui 副本）/ R9（`@/hooks` 别名）                                 | 不变 / **对本组件失效**                                                        | 补注                                                |
| §5 skill 偏离（原生 `<li>` + footer 按钮）                                    | **不变**，且**新增适用面**：迁入的 ②③④⑤ 行同样必须是 `<li>`（§6）              | 无（补注）                                          |

---

## 2. D-2 裁决：数据映射 = **同一组件、同一状态接口、单一来源开关**（不变 + 扩充）

**裁定**：**同一组件同一状态接口**（**否决** web 只读变体）。理由：C1–C16 与 nue-ui 下拉 a11y/焦点/池细节复制两份必然漂移；web 要的是 desktop 的**真子集**（无 push 队列）。

**接口形态**（默认值 = desktop 现行为）：

```text
props: {
  // 首行时间的来源：'lastSync'（desktop 默认，逐字不变）| 'mirrorPulledAt'（web）
  syncTimeSource?: 'lastSync' | 'mirrorPulledAt'
}
```

### 2.1 逐字段映射（含 T115c 新增的数据可信度字段）

| 面板字段              | desktop 语义与来源                     | **web 等价语义**                                            | web 来源                                                                    | 依据                                                          |
| :-------------------- | :------------------------------------- | :---------------------------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------ |
| `syncing`             | 拉取/推送执行中                        | **同义**                                                    | `syncStatus.syncing`                                                        | 同一 `syncService`（C-66）                                    |
| 首行时间              | `lastSyncAt`                           | **上次完整拉取时间**                                        | **`syncStatus.mirrorPulledAt`**                                             | P4：`lastSyncAt` 截断时会推进且不落盘 ⇒ 谎报                  |
| `pendingCount`        | `syncQueue` 待推送数                   | **N/A ≡ 0**                                                 | 常量 0                                                                      | C-59（r5）：web 无本地写路径 ⇒ 队列恒空；既有 `v-if` 自动隐行 |
| `failedCount`         | `retryCount > 0`                       | **N/A ≡ 0**                                                 | 常量 0                                                                      | 同上                                                          |
| `paused`              | SHELL-06 C-41 推送暂停                 | **N/A ≡ false**                                             | 常量 false                                                                  | 同上                                                          |
| `lastError`           | 运行首个错误                           | **同义（web 新增能力）**                                    | `syncStatus.lastError`                                                      | 同一运行边界                                                  |
| **`isOffline`**       | 只读/离线态                            | **同义**                                                    | `useReadOnlyState().isReadOnly`（`@nao-todo/presentation/offline`，shared） | C-59                                                          |
| **`mirrorPulledAt`**  | 镜像完整拉取时间                       | **同义**                                                    | `syncStatus.mirrorPulledAt`（`getMirrorState()` 仅是其透传，P7）            | C-60 r5                                                       |
| **`mirrorTruncated`** | 续拉触顶                               | **同义**                                                    | `syncStatus.mirrorTruncated`                                                | AC13b / 护栏 B                                                |
| 「立即同步」          | `syncService.manualSync()`（先拉后推） | **同 API**；web 推送为空操作 ⇒ 语义 = **立即拉取/刷新镜像** | 同一 `useManualSync`                                                        | `sync-service.ts:1015-1027`                                   |

### 2.2 派生信号（纯函数，**不改写**）

```text
freshness = resolveFreshness({ isOffline, mirrorPulledAt, mirrorTruncated })   // 'updated' | 'mirror' | 'incomplete'
coverage  = resolveCoverageHints({ syncing, mirrorTruncated })                 // { loadingMore, truncated }
timeText  = formatMirrorPulledAt(mirrorPulledAt, locale)                       // string | null
```

`packages/presentation/offline/{freshness,coverage}.ts` **零改动**（C-60 ②③ 互斥穷尽与负向纪律原样保留）。

### 2.3 依赖面收口（新增，确保两端可复用）

| 现依赖                                                                                              | 处理                                               | 理由                                                                                  |
| :-------------------------------------------------------------------------------------------------- | :------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `use-mirror-status.ts`（4 个输出 = `isOffline` + `mirrorPulledAt` + `mirrorTruncated` + `syncing`） | **删除**（其唯一消费者 `offline-status.vue` 被删） | 4 个输出全部可由 `useSyncStatus()` + `useReadOnlyState()` 直接取得 ⇒ 删除后无功能损失 |
| `use-mirror-loaded-count.ts` 的 `getMirrorState()`                                                  | 改为 `syncStatus.get().mirrorTruncated`            | 避免 shared 面板依赖 web-only 运行接线模块 `@/data-plane`（P7）                       |

---

## 3. D-3（**r7 修订**）：顶部零挂载 + 全部状态迁入状态组件

### 3.1 修订依据与作废条款

- **用户裁定**（原话见文首）**取代** PM 原 DP-1（两端生效 vs 端门控）与 DP-3（②③④⑤ 保留原位）。
- **DP-1 结论 = 「两端生效」**（顶部条在两端同时消失）—— 因该条是两端共用代码（P1），且用户口径是「头部不挂载任何组件」，无端区分必要。
- **DP-3 结论 = 「全部迁入面板」**（②③④⑤ 全部迁入；顶部零挂载）。
- **DP-5 结论 = C-60 ① 退役 + ②③ 渲染点由「内容区」改为「面板」**（条款须修订，见 §10-S2）。

### 3.2 逐条处置清单（7 条文案 + 3 项结构）

| #     | 信息项（i18n 键）                                  | 文案                                                                     | **r7 处置**                                     | AC/条款                   | 迁入后如何满足（二段式，详见 §5）                                                                                       |
| :---- | :------------------------------------------------- | :----------------------------------------------------------------------- | :---------------------------------------------- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| **E** | `offline.freshness.updated`                        | 「已更新」                                                               | **不渲染**（① 退役；键保留）                    | C-60 ①（**条款修订**）    | 在线态由面板首行「上次同步 {time}」承载；无告警时**零视觉噪音**                                                         |
| **C** | `offline.freshness.mirror`                         | 「离线模式 · 数据截至 {time}」                                           | **迁入面板**（`<li>`）                          | **AC8**                   | 不点开：warn 角标 + `aria-label`/tooltip「同步 · 可能不是最新」；点开：**原文案含时间**                                 |
| **D** | `offline.freshness.mirrorHint`                     | 「可能不是最新」                                                         | **迁入面板**                                    | **AC8**                   | 同上（同分支）                                                                                                          |
| **A** | `offline.freshness.incomplete`                     | 「尚未同步完成，数据可能不完整」                                         | **迁入面板**                                    | **AC9**、C-60 ③           | 不点开：alert 角标 + 「同步 · 尚未同步完成，数据可能不完整」；点开：原文案                                              |
| **B** | `offline.freshness.incompleteHint`                 | 「请连接网络后重试」                                                     | **迁入面板**                                    | **AC9**（引导联网）       | 点开可见（**引导语在零交互下不可见** ⇒ §5.2 明确登记）                                                                  |
| **F** | `offline.coverage.loadingMore`                     | 「正在加载更多…」                                                        | **迁入面板**                                    | 范围⑤ / coverage 设计约束 | 点开可见；零交互下由轨道按钮 `:loading` 图标承担（**语义近似，非逐字**）                                                |
| **G** | `offline.coverage.truncated` / `.truncatedGeneric` | 「已加载 N 条，仍有更多未加载」/「任务数量超过同步上限，仅显示部分数据」 | **迁入面板**                                    | **AC13b** + 护栏 B        | 不点开：alert 角标 + 「同步 · 任务数量超过同步上限，仅显示部分数据」（**通用文案**，不编造 N）；点开：**含 N 的原文案** |
| 结构  | 内容区根条 + `.is-alert` 底色 + `border-bottom`    | —                                                                        | **删除**（`offline-status.vue` 整体删除，§6）   | 用户口径                  | 内容区顶部**零挂载** ⇒ 不再占用内容区高度                                                                               |
| 结构  | 面板内每行必须为 `<li>`                            | —                                                                        | **新增约束**                                    | SHELL-02 AC-11 / §5 / C12 | 迁入行一律 `<li><nue-text/></li>`（P8）                                                                                 |
| 结构  | `role="status"` + `aria-live`                      | —                                                                        | **由面板内信息区 + 轨道按钮 `aria-label` 承担** | SHELL-02 AC-12 / NFR      | `aria-label` 常态逐字不变；异常态追加状态短语（§4.3）                                                                   |

---

## 4. D-4：rail 轨道按钮的**状态指示形态**（T115c 核心新增）

### 4.1 四通道设计（正交，互不覆盖）

| 通道                              | 承载                                        | 可见时机          | 是否新增                    |
| :-------------------------------- | :------------------------------------------ | :---------------- | :-------------------------- |
| **① 图标**                        | `:loading` ⇒ loading 图标 + spin            | 同步中            | 既有（不变）                |
| **② 颜色** `--nue-button-color`   | **同步管线健康**：失败 / 待推送·暂停 / 常态 | 常驻              | 既有（**C14/D2 逐字不变**） |
| **③ 角标** `::after` 圆点         | **数据可信度**：不完整·触顶 / 离线镜像      | 常驻              | **新增**                    |
| **④ 文案** `aria-label` + tooltip | 状态**名称**（由既有 i18n 键拼接）          | 常驻（读屏/悬停） | **新增（不新增 i18n 键）**  |

> **`::after` 而非子节点**：`nue-button` 内部为 flex 布局，插入子 `<span>` 可能引入内部 `gap` 从而改变 24×24 盒（**AC-11 回归**）；伪元素**不产生节点**，且 `.sync-rail-btn` 的 scoped 样式已验证可作用于库按钮根（现有 `border:0` 即依赖此）⇒ **零 layout shift**（AC-02/AC-11 不回归）。圆点置于按钮盒**内**（`top:1px; right:1px`），规避 `.nue-aside{overflow:auto; overflow-x:hidden}` 的裁切风险。

### 4.2 状态 → 指示形态映射表（**不点开即可见**）

| 数据/管线状态           | 判定表达式（信号源见 §2）                         | **通道② 颜色**                       | **通道③ 角标**                                | **通道④ 文案**（`aria-label` / tooltip）                                                      | 面板内（点开）                      |
| :---------------------- | :------------------------------------------------ | :----------------------------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------------------- | :---------------------------------- |
| 同步中                  | `syncing`                                         | 常态色（loading 图标，**C14 不变**） | 按下方数据状态照常显示                        | `sync.syncing`（不变）                                                                        | 首行「同步中…」+ ④ 行               |
| 推送失败                | `failedCount > 0`                                 | `--nue-error-color-60`（**不变**）   | 按数据状态照常显示                            | `sync.title` + `sync.failed`                                                                  | 失败 N + `lastError`                |
| 待推送 / 暂停           | `paused \|\| pendingCount > 0`                    | `--nue-warning-color-60`（**不变**） | 按数据状态照常显示                            | `sync.title` + `sync.pendingOffline`/`pending`                                                | 待推送/暂停行                       |
| **数据不完整 / 已触顶** | `freshness === 'incomplete' \|\| mirrorTruncated` | **不受影响**（保持管线色）           | **alert 实心圆点**（`--nue-error-color-60`）  | `sync.title` + `offline.freshness.incomplete`（触顶时用 `offline.coverage.truncatedGeneric`） | ③ 两行（含引导联网）/ ⑤（**含 N**） |
| **离线 · 有镜像**       | `freshness === 'mirror'`                          | 同上                                 | **warn 实心圆点**（`--nue-warning-color-60`） | `sync.title` + `offline.freshness.mirrorHint`（「可能不是最新」）                             | ② 两行（**含「数据截至 X」**）      |
| 常态                    | 以上皆否                                          | `--nue-primary-color-600`（不变）    | 无                                            | `sync.title`（**逐字不变**）                                                                  | 首行时间                            |

### 4.3 与 SHELL-02 C14/D2 的**优先级合并规则**（PM 指定回答项）

```text
通道②（颜色，管线健康）优先级 —— 逐字不变，新增状态不插入：
    同步中(loading 图标) > 失败 > 待推送·暂停 > 常态

通道③（角标，数据可信度）优先级 —— 新增，独立求解：
    alert(不完整 或 触顶) > warn(离线·有镜像) > 无

合并规则：
    R1  两通道**正交、同时呈现**，互不覆盖（不做「谁压谁」的降级）。
    R2  「同步中」**不吞掉**角标（数据可信度与是否正在同步无关）。
    R3  通道② 的取值集合与优先级**一字不改** ⇒ desktop 既有 AC-04/AC-11 断言零回归。
    R4  通道③ 的两级均以「实心圆点 + 不同色」表达；颜色语义 = 「数据可信度」，
        与通道② 的「管线健康」语义**分离**（即使同为 error 色，由通道④ 文案区分）。
```

**为什么把新增状态放在角标通道而不是插入颜色通道**：

1. 颜色通道是**单值**（一个 `--nue-button-color`），插入即**重新定义** C14/D2 的语义与优先级 ⇒ desktop 的 AC-04（失败色）/AC-11（与齿轮同色）**断言面被动回归**；
2. 「管线健康」与「数据可信度」是**两个不同的问题域**（前者：我的写有没有推上去；后者：我看到的数据是不是旧的/缺的），合并到一色会**信息丢失**；
3. 角标是**新增视觉通道**，其存在/取值**不影响**既有任何几何与颜色断言（§4.1 伪元素论证）。

### 4.4 可访问性（NFR 对齐，AC-12 口径）

| 项                                 | 常态                                                 | 异常态                                                                                                               |
| :--------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `aria-label`                       | **`sync.title`（逐字不变，AC-12 现有断言保持通过）** | `sync.title` + `' · '` + 状态短语（既有键）                                                                          |
| tooltip `content`                  | 同 `aria-label`（**由既有键拼接，不新增 i18n 键**）  | 同左                                                                                                                 |
| `aria-expanded`                    | 不变（trigger slot `visible`）                       | 不变                                                                                                                 |
| `.sync-live-region`（`aria-live`） | `''` / 「同步中…」/「失败 N」（**现有断言保持**）    | **新增一档**：数据不完整·触顶时播 `offline.freshness.incomplete`（**登记 AC-12 断言扩展**，仅摘要、不含时间/N 全文） |

---

## 5. D-5：AC8 / AC9 / AC13b 在「顶部零挂载」下的逐条满足论证

> **统一定义 —— 二段式可见性**：**第一段（零交互）**= 轨道按钮的通道②/③/④（角标 + 颜色 + 状态名称）；**第二段（点开）**= 面板内**逐字保留的原文案**（含时间 / N / 引导语）。

### 5.1 AC8（离线 + 有镜像 ⇒ 显示「离线模式 · 数据截至 X」）

| 阶段                             | 满足内容                                                                                                                                          | 验证方式（QA 可测）                                                                                                                           |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| 零交互                           | 轨道按钮 **warn 圆点** 存在；`aria-label` = 「同步 · 可能不是最新」；tooltip 同                                                                   | jsdom：断言 `.sync-rail-btn.is-data-warn` 存在 + `aria-label` 包含 `offline.freshness.mirrorHint` 文案；Electron/浏览器：截图人眼核验圆点可见 |
| 点开                             | 面板 `<li>` 显示 `offline.freshness.mirror`（**含「数据截至 X」**）+ `.mirrorHint`；时间经 `formatMirrorPulledAt` ⇒ 无 `null`/`Invalid Date`/1970 | 断言面板文本含「离线模式 · 数据截至」且不含 `null`/`1970`（**既有 `offline-status.test.ts` 的负向断言原样迁移**）                             |
| **口径修订（必须登记）**         | AC8 的 Then 由「打开即显示（无交互）」改为「打开即**指示**（圆点 + 状态名）；**完整文案（含时间）在面板内**」                                     | **PM 修订 PRD AC8 的 Then 与验证方式；QA 按二段式验收**                                                                                       |
| 替代方案（若 PM 不接受口径修订） | **toast**（进入离线时一次性提示「数据截至 X」）                                                                                                   | ❌ **不推荐**：toast 为瞬态、不常驻；且引入新浮层 + 定时器，与 SHELL-02 **C2（无自建定时器）** 冲突，需 ADR 例外                              |

### 5.2 AC9（离线 + 无镜像 ⇒ 引导联网，不得呈现为「数据丢失」）

| 阶段                     | 满足内容                                                                                            | 验证方式                                                                                                                                                    |
| :----------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 零交互                   | **alert 圆点** + `aria-label` = 「同步 · 尚未同步完成，数据可能不完整」（**不含**「数据丢失」字样） | 断言 `is-data-alert` 存在 + `aria-label` 含 `offline.freshness.incomplete`；负向断言「不得出现 `数据丢失`/`null`/`1970`」对 `aria-label` 与面板文本均成立   |
| 点开                     | 面板显示 `offline.freshness.incomplete` + **`incompleteHint`（「请连接网络后重试」= 引导联网）**    | 断言面板文本含两段原文案                                                                                                                                    |
| **口径修订（必须登记）** | 「引导联网」文案**在零交互下不可见**（角标无法承载长引导语）；AC9 的「引导联网」降级为「点开可见」  | **PM 修订 PRD AC9 的 Then/验证方式**；或接受「零交互 = 状态名（不完整）+ 点开 = 引导语」                                                                    |
| 替代方案                 | 把引导语放进 tooltip（悬停可见，非点击）                                                            | ⚠️ 可选加固：tooltip 内容改为 `incomplete` + `incompleteHint` 拼接（仍复用既有键）。**代价**：tooltip 变长；**仍非零交互**（需悬停）⇒ 不构成 AC9 的完整替代 |

### 5.3 AC13b（上界内拉完 **或** 不推进 `mirrorPulledAt` + 触顶）

| 阶段                    | 满足内容                                                                                                                                                       | 验证方式                                                                                               |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| 引擎侧（不变）          | `mirrorTruncated = true` 且 `mirrorPulledAt` **不推进**（`markMirrorTruncated` / `markMirrorPulled`，`sync-status.ts:155-160`）                                | `def6-mirror-completeness.test.ts`（既有，零改动）                                                     |
| 零交互                  | **alert 圆点**（`mirrorTruncated` 独立判定，**在线也成立**）+ `aria-label`/tooltip = 「同步 · 任务数量超过同步上限，仅显示部分数据」（**通用文案，不编造 N**） | 断言 `is-data-alert` + `aria-label` 含 `offline.coverage.truncatedGeneric`                             |
| 点开                    | 面板 ⑤ 行显示 `offline.coverage.truncated`（**含 N**）或 `.truncatedGeneric`；N 取 `useMirrorLoadedCount()` 实际行数，取不到退通用文案                         | 断言面板文本含「已加载 N 条，仍有更多未加载」/「同步上限」；**既有用例（N=200 / N=0 退通用）原样迁移** |
| **口径说明（非降级）**  | 触顶的**存在性**在零交互下**可见**（圆点）；**N 的数值**需点开。符合 PRD 边界⑦「触顶文案不编造数字」（通用文案合法）                                           | PRD 范围⑤ 措辞更新：覆盖度/触顶提示渲染点 = 面板（§10-S3）                                             |
| 在线 + 触顶（易漏分支） | `resolveFreshness` 在**在线**时恒返回 `'updated'` ⇒ ②③ 不显示；但 `mirrorTruncated` **独立**驱动 alert 圆点 + ⑤ 行                                             | **必须补用例**：`isOffline=false, mirrorTruncated=true` ⇒ 圆点存在 + 面板 ⑤ 行存在                     |

### 5.4 ⚠️ **无法在「顶部零挂载」下满足的部分（显式报告，不静默降级）**

| #       | 无法满足项                                                                                                                                      | 影响                                                                | 替代方案                                                                                                                                                                                                                                                                                                                                              | 建议                                                                  |
| :------ | :---------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **N-1** | **≤445px（抽屉分支）完全无同步状态**（P6）：顶部条移除后，抽屉分支不绑定 `railBottomHost` ⇒ 面板整体不渲染 ⇒ **AC8/AC9/AC13b 在窄屏全部不可验** | 手机宽度 web 用户：看不到任何离线/未同步/触顶提示（**比现状更差**） | **替代 1（推荐）**：在 `aside-v2-drawer.vue` 的 `nue-footer` 内**也绑定注入点**（`bindRailBottomHost`），使窄屏亦有轨道按钮 ⇒ 需修订 SHELL-02 **C5/AC-08**（「抽屉 ⇒ 不渲染」）+ 抽屉几何回归；**替代 2**：接受缺口，PRD 记为**已知能力缺口**，QA 不得在窄屏按 AC8/AC9/AC13b 判通过；**替代 3**：抽屉 footer 内放内联状态文本（非头部，不违用户口径） | **替代 1**（一次性补齐，代价可控）；须 PM 裁定（**DP-6**）            |
| **N-2** | AC8 的「数据截至 {time}」、AC9 的引导语、AC13b 的「已加载 N 条」在**零交互**下不可见                                                            | 见 §5.1–§5.3                                                        | 二段式可见性 + PRD 口径修订                                                                                                                                                                                                                                                                                                                           | 建议接受（**DP-5 已由用户裁定锁定为「全部入面板」**，故此项不可避免） |

---

## 6. D-6：`offline-status.vue` 处置 + i18n 键「不增不删」落实

### 6.1 处置 = **删除**（不保留为面板内部子组件）

| 判据                                                                       | 结论                                                                                                                                                                             |
| :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 面板根是库渲染的 `<ul>`，直接子节点必须为 `<li>`（P8 / C12 / SHELL-02 §5） | `offline-status.vue` 根为 `<div class="offline-status">`，且带 `border-bottom` / 警示底色 / `role="status"` 容器语义 ⇒ 作为子组件嵌入会产生 **`<div>` 直挂 `<ul>`（非法 HTML）** |
| 若为嵌入而改写其根为 `<li>` + 删样式                                       | 则它与面板其余行**无任何可复用结构**，仅剩 3 个 computed 包装 ⇒ **抽象无收益**                                                                                                   |
| AGENTS.md §2「不为单次使用造抽象」/ §3「清理自身造成的孤儿」               | **删除**，其逻辑（`resolveFreshness`/`resolveCoverageHints`/`formatMirrorPulledAt`/`useMirrorLoadedCount`）**全部保留并迁入面板**                                                |

**删除/迁移清单**：

| 文件                                                                     | 处置                                                     |
| :----------------------------------------------------------------------- | :------------------------------------------------------- |
| `apps/web/src/components/offline/offline-status.vue`                     | **删除**                                                 |
| `apps/web/src/components/offline/__tests__/offline-status.test.ts`       | **改写**为面板用例（6 例断言全部保留，见 §10-S7）        |
| `apps/web/src/components/offline/use-mirror-status.ts`                   | **删除**（§2.3；唯一消费者被删）                         |
| `apps/web/src/components/offline/use-mirror-loaded-count.ts`（+ 其测试） | **移入** `apps/web/src/hooks/`（去 `@/data-plane` 依赖） |
| `apps/web/src/components/offline/index.ts`                               | 去掉 `OfflineStatus` 导出（保留 hooks 导出）             |
| `apps/web/src/views/index/index.vue:5,31`                                | 移除 import + `<offline-status />`                       |
| `packages/presentation/offline/{freshness,coverage}.ts`                  | **零改动**                                               |

### 6.2 i18n 键「不增不删」的落实方式

| 键                                                                             | 状态                                                                                          |
| :----------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `offline.freshness.mirror` / `.mirrorHint` / `.incomplete` / `.incompleteHint` | **原样复用**（渲染点：内容区 → 面板 `<li>`）                                                  |
| `offline.coverage.loadingMore` / `.truncated` / `.truncatedGeneric`            | **原样复用**（同上）                                                                          |
| `offline.freshness.updated`                                                    | **保留但无渲染点**（① 退役；保留以支持回滚，且避免牵动 3 处 locales + `types.ts` 的联动门禁） |
| `sync.*`（9 键）                                                               | **原样复用**                                                                                  |
| **通道④ 的 tooltip/`aria-label` 文案**                                         | **由既有键拼接**：`t('sync.title') + ' · ' + t(<状态键>)` ⇒ **不新增键**                      |
| `zh-CN` / `en-US` / `types.ts`                                                 | **零改动**（三处一致性自动保持）                                                              |

---

## 7. D-7（**r8 已裁定**）：头部其余挂载组件 ⇒ **`NueMessage` / `NueConfirm`**

用户裁定（原话）：「**不要使用 banner，改为 NueMessage 或 NueConfirm**。」（同时确认「头部零挂载」）⇒ D-7 由「待裁定」转为**已裁定**，完整口径与 AC 论证见 **§8**。

| #     | 组件                                                                                                                              | 裁定后处置                                                                                                                                                                                                                    | 对应 AC                 | 状态                |
| :---- | :-------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------- | :------------------ |
| DP-7a | `offline-read-only-banner`（`packages/presentation/offline/read-only-banner.vue`）—— **⚠️ 该文件已删除（历史）**                  | **移除** ⇒ **`NueMessage`**：在**写被拦截的那一刻**提示（由 web-only 统一拦截处 `write-gate.notifyReadOnly()` 触发；**非「离线即弹」**）。**该能力本就存在**（`write-gate.ts:36-41`）⇒ **无需新增代码**，原 banner 属**冗余** | **AC10 / C-59**（§8.2） | ✅ **已交付（RD）** |
| DP-7b | `plaintext-notice-banner`（`apps/web/src/components/plaintext-notice/plaintext-notice-banner.vue`）—— **⚠️ 该文件已删除（历史）** | **移除** ⇒ **`NueConfirm`**：一次性告知，**确认后**写设备级已读标记、不再展示（`unuseCancelButton: true` = 单按钮形态**原生支持**）                                                                                           | **AC17**（§8.3）        | ✅ **已交付（RD）** |

> **API 命名纪律**：nue-ui 的导出是 **`NueMessage.warn(...)`**（payload 类型才叫 `'warning'`）；**不存在** `NueMessage.warning`。本 ADR 与后续实现一律以 `NueMessage.warn` 为准。

> ⚠️ **本 ADR 在 r7 曾建议「先查布局根因再定删/修」**：用户已直接裁定「改 `NueMessage`/`NueConfirm`」（等价于「删 banner」）⇒ 该建议**被裁定取代**；但**「底部被遮住」的布局根因仍须由 rd-fe 复现留痕**（若为 `router-view` 容器 flex 缺陷 ⇒ 仍应修，否则其他头部内容（如后续新增）会复发）——记入风险 R-12。

---

## 8. D-8（r8 新增）：头部零挂载**完整口径** + AC10 / AC17 修订论证

### 8.1 三个挂载点处置（穷尽）

| #   | 挂载点（`views/index/index.vue`，均在 `<nue-content>` 内、`<router-view>` 之上） | 处置                                                                                         | 承载 AC                               |
| :-- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------ |
| 1   | `<offline-status />`（`:31`）                                                    | **迁入左下角状态组件**（②③④⑤ 全部迁入 + rail 状态指示；`offline-status.vue` 删除）           | C-60 / **AC8 / AC9 / AC13b**（§3–§6） |
| 2   | `<offline-read-only-banner />`（`:7,29`）                                        | **移除** ⇒ **`NueMessage`**（写被拦截时；web-only 拦截处触发）——**已交付**（组件文件已删除） | **AC10 / C-59**（§8.2）               |
| 3   | `<plaintext-notice-banner />`（`:27`）                                           | **移除** ⇒ **`NueConfirm`**（首启一次性确认）——**已交付**（组件文件已删除）                  | **AC17**（§8.3）                      |

**实现现状（r9，读码核实）**：`plaintext-notice-banner.vue`、`read-only-banner.vue`（+ 两者测试）**已删除**，`presentation/offline/index.ts` 的 `OfflineReadOnlyBanner` 导出已移除，`index.vue` 已改挂 `showPlaintextNoticeConfirm()`；**`<offline-status />` 仍保留在头部**（遵 PM 指示，待 §3–§6 面板落地后与 `offline-status.vue` 一并移除）。

**处置后**：`<nue-content>` 内**仅剩 `<router-view>` 与对话框适配器**（对话框不占布局）⇒ 用户口径「**不要在头部那一块地方挂载任何组件**」**完全达成**；内容区不再被兄弟块挤压（「底部被遮住」的直接诱因消失）。

### 8.2 AC10（离线只读 ⇒ 统一禁写 + **可见提示**）修订后的满足论证与验证

**现状（读码）**：提示**本就是双份**——① 常驻横幅 `OfflineReadOnlyBanner`（`isReadOnly` ⇒ 渲染，**该文件与导出均已删除**）+ ② **写被拦截时** `write-gate.notifyReadOnly()` → `NueMessage.warn(t('offline.readOnlyHint'))`（`packages/presentation/offline/write-gate.ts:36-41`，**节流 1200ms**），由 web 统一写闸门 `apps/web/src/hooks/usecases/binding.ts` 的 `withReadOnlyGuard(...)` 在**拦截时**调用（**非「离线即弹」**）。

**RD 实证结论（r9）**：AC10 的可见性**本就由既有 write-gate 承担**（既有实现 + 既有测试）⇒ **无需新增任何代码**；被删除的横幅属**冗余** ⇒ **DP-7a 关闭**。

**修订后**：**② 为唯一提示时机**（① 移除）⇒ AC10 的「可见提示」仍成立（提示存在于**写被拒的那一刻**），且**不再有常驻横幅**。

| 验收面       | 内容                                                                                                                                   | 验证方式                                                                                                                                            |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| 统一禁写     | web 写入口（清单以报告 §3.3 为唯一真源，当前 25 项）离线时被 `withReadOnlyGuard` 拦截，返回形态不变，**仓储零写入 ⇒ `markDirty` 恒 0** | `write-gate.test.ts` 既有断言（仓储方法未调用）                                                                                                     |
| **可见提示** | 拦截时 `NueMessage.warn(t('offline.readOnlyHint'))`，**节流 1200ms**（连续写不刷屏）                                                   | **既有 3 条断言零改动即可覆盖**：拦截 ⇒ `warn` 调用 1 次且文案含「离线」（`write-gate.test.ts:78-79`）；可写 ⇒ 不调用（`:104`）；节流（`:116-128`） |
| 端隔离       | desktop **不触发**该 toast（web-only 注入，见 §8.4）                                                                                   | desktop binding 零引用 + 既有 C-59 r5 断言                                                                                                          |
| 人眼         | 离线点任意写入口 ⇒ toast 出现；`markDirty` 恒 0                                                                                        | 浏览器/Electron 冒烟                                                                                                                                |

**⚠️ 语义变更（显式登记，非静默降级）**：AC10 的「可见提示」由「**常驻**（横幅）+ 拦截时（toast）」变为「**仅拦截时**（toast）」⇒ **离线态本身不再有常驻可见提示**。

| 补位             | 说明                                                                                                                                                                                 |
| :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **轨道指示补位** | 离线态仍由**状态组件的 rail 指示**常驻可见（§4.2：`isOffline` ⇒ `freshness` 为 `mirror`/`incomplete` ⇒ warn/alert 圆点）⇒ 「离线可见性」并未消失，只是从**头部横幅**改为**轨道指示** |
| **窄屏例外**     | ≤445px 无 rail（N-1 / DP-6）⇒ 该补位**不成立**；此时 AC10 仅由**拦截时 toast** 满足（AC10 本身仍成立，但「离线可见性」在窄屏**零交互不可见**）                                       |

**替代方案**（若 PM 要求离线态**常驻**可见提示）：只能在**状态组件内**加只读行 + 角标（面板内，**非头部**）⇒ 属**新设计**，须另派；本单不扩范围。

### 8.3 AC17（明文姿态首启一次性告知）修订后的满足论证与验证

**修订后**：`plaintext-notice-banner` 移除 ⇒ 首启由 **`NueConfirm`** 一次性告知。

| 项                 | 设计                                                                                                                                                                                                                                                                              |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 触发时机           | 主界面挂载时（`index.vue` 的 `onMounted`）⇒ 与现状「进入主界面即告知」等价                                                                                                                                                                                                        |
| 形态               | `NueConfirm({ title, content, confirmButtonText, unuseCancelButton: true })`，文案取**既有 i18n 键** `notice.plaintext.title` / `.body` / `.dismiss`（**不新增键**）                                                                                                              |
| 已读标记           | **仅 `isByCancel === false`（确认）** 时调 `acknowledgePlaintextNotice()` ⇒ 写 `PLAINTEXT_NOTICE_ACK_KEY`（**设备级**，在 `DEVICE_LEVEL_STORAGE_KEYS` 白名单内 ⇒ 登出清库**不清**，不重复弹）                                                                                     |
| 不再展示           | `isPlaintextNoticeAcknowledged()` 为真 ⇒ **不调用** `NueConfirm`                                                                                                                                                                                                                  |
| **Esc / 遮罩关闭** | 源码核实：`onEscape` 走 **cancel 路径**（`close(true, null)`）⇒ `isByCancel === true` ⇒ **不写已读标记 ⇒ 下次仍展示**（符合「**确认后**才不再展示」）。若 PM 希望「任何关闭都算已读」⇒ 改挂 `afterClose`（一行差异），但会弱化「已告知」的确认性 ⇒ **arch 建议维持 confirm-only** |

**两版等价性证据（SHELL-02 C6′ 要求，读码核实）**：

| 证据               | 结果                                                                                                                                                          |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API 声明           | `dist/types/components/confirm/{index,types}.d.ts` 在 **1.10.58 / 1.11.0 逐字一致**（`NueConfirm(payload) => Promise<[isByCancel, result]>`）                 |
| 单按钮形态         | 两版均支持 `unuseCancelButton: true`（⇒ PM 的「若不支持单按钮 ⇒ 等价形态」**无需退化**，原生支持）                                                            |
| 弹层归属           | 两版实现均调 `mountPopupAnchor()` / `unmountPopupAnchor()` ⇒ **经弹层池**（符合 SHELL-02 D-3 铁律：新增浮层一律经池；**我方不新增 z-index、不新增自绘浮层**） |
| `NueMessage`       | `dist/types/components/message/*.d.ts` 两版**逐字一致**；且 `NueMessage.warn` **已在** `write-gate.ts` 使用（**既有**，非本单新增）                           |
| **连带（必须做）** | ⇒ **`NueConfirm` / `NueMessage` 须追加进 SHELL-02 C6′ 的「两版行为等价根导出」白名单**（S1⑥）                                                                 |

**验收面**：

| 面                 | 验证方式                                                                                                                                                                                                                                                                                                             |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单元               | 未确认 ⇒ 调用 `NueConfirm`，断言 payload（`title`/`content`/`confirmButtonText` = 既有 i18n 键；`unuseCancelButton === true`）；resolve `[false, null]` ⇒ `acknowledgePlaintextNotice()` 被调 + `localStorage[PLAINTEXT_NOTICE_ACK_KEY] === '1'`；resolve `[true, null]`（Esc）⇒ **不写标记**；已确认 ⇒ **不再调用** |
| 设备级             | 登出清库后仍不重复弹（键在白名单内）—— 既有 `deletion-wipe.test.ts:244` 覆盖键保留                                                                                                                                                                                                                                   |
| 人眼（AC17）       | 首启观感 + 文案**不含「加密」字样**、不给「已加密/受保护」式虚假安全感（既有 `plaintext-notice.test.ts` 约束保留）                                                                                                                                                                                                   |
| **实测（RD，r9）** | **真实 Chromium + CDP**：清标记 ⇒ 首启弹「本地数据为明文保存」+ **仅 1 个「我知道了」**；点击后 `nao.plaintextNoticeAck=1` 且不再展示；**零 console warn/error** ⇒ **DP-7b 关闭**                                                                                                                                    |

**⚠️ 语义变更（显式登记）**：AC17 原文「可关闭、**不阻塞使用（非模态）**」→ **模态一次性确认**（阻塞交互直至确认；Esc 可关闭但不记为已读）⇒ **PRD AC17 措辞须修订**（S12）。若 PM 不接受阻塞 ⇒ 替代：`NueMessage`（非阻塞，但**无「确认」语义**，无法保证用户读到 ⇒ 与「告知」的合规意图弱化）；**arch 建议保留 `NueConfirm`**（用户已裁定）。

### 8.4 desktop 不受影响（PM 指定确认项）

| 项                                                                                                         | 结论                                                                                                                                                                                         | 证据                                                                                                                                                                                                                                                                                                                                                                                              |
| :--------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **写闸门（含 toast）是否影响 desktop**                                                                     | ❌ **不影响**                                                                                                                                                                                | `withReadOnlyGuard` / `notifyReadOnly` 经 **web-only 装配钩子**注入：`apps/web/src/hooks/usecases/binding.ts` 的 `decorateUseCase`；**desktop binding（`apps/desktop/src/renderer/src/hooks/usecases/binding.ts`）零引用** `withReadOnlyGuard` / `decorateUseCase` / `presentation/offline` / readOnly（读码核实）⇒ **desktop 离线写不被拦截、不弹 toast**（C-59 r5：desktop 写路径**逐字不变**） |
| `read-only-banner.vue` 在**两端共用目录**（`packages/presentation/offline/**`）是否让 desktop 产生可见变化 | ⚠️ **有，但属用户裁定的两端一致后果**                                                                                                                                                        | 该横幅的**挂载点在被移除的 `index.vue` 头部**（两端共用）⇒ 移除后**两端都不再渲染**横幅。desktop 因此**少一个常驻横幅**（视觉变化），但**写路径/拦截逻辑零变化**（上一条）⇒ 与 C-59 r5「desktop 写路径一律不变」**不冲突**                                                                                                                                                                        |
| `plaintext-notice-banner`                                                                                  | 两端同样改为 `NueConfirm`                                                                                                                                                                    | 挂载点共用；`plaintext-notice.ts` 的标记逻辑与设备级键**不变** ⇒ 已确认用户不受影响                                                                                                                                                                                                                                                                                                               |
| 孤儿清理                                                                                                   | `read-only-banner.vue`（+ 其测试）与 `plaintext-notice-banner.vue` 变为**无引用**                                                                                                            | 按 AGENTS.md §3「清理自身造成的孤儿」⇒ 由**制造孤儿者**（rd-fe-T115b，并行执行方）删除；`packages/presentation/offline/index.ts` 的 `OfflineReadOnlyBanner` 导出同步移除                                                                                                                                                                                                                          |
| **i18n 键不增不删**                                                                                        | `offline.readOnlyBanner` 变为**无渲染点的键**（保留，与 `offline.freshness.updated` 同列）；`offline.readOnlyHint` **仍被 write-gate 使用**；`notice.plaintext.*` **仍被 `NueConfirm` 复用** | §6.2 原则                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 9. 不变量（可勾选）

- [ ] **内容区顶部零挂载**：`index.vue` 内 `<router-view>` 之上**不再有** `offline-status`（本单范围）；DP-7a/7b 待裁定。
- [ ] **desktop 行为不变**：除「顶部条不再渲染」外，轨道按钮/面板结构、**C1–C16 全部行为**、`aria-live` 摘要（+1 档）、焦点归还、几何（AC-01/02/07/11）、**C14/D2 三态着色逐字不变**。
- [ ] **C-60 ②③ 互斥穷尽且渲染点唯一**（面板内；不新增第二处）。
- [ ] **AC10 / C-59 只读可见提示不受影响**（`OfflineReadOnlyBanner` 未触碰，DP-7a 待裁定）。
- [ ] **web 不得因本单新增任何本地写路径**（C-59 r5）。
- [ ] **移动端红线**：`packages/presentation-react`、`apps/mobileapp` **零改动**（`git status --porcelain -- packages/presentation-react apps/mobileapp` = 0）。
- [ ] **服务端契约零改动**。
- [ ] **i18n 键不增不删**（§6.2）⇒ 三处 locales 零改动。
- [ ] **零 layout shift**：轨道按钮 24×24 盒与齿轮 rect **逐位不变**（角标走 `::after`，§4.1）。

---

## 10. 连带同步清单（含 Owner）

| #       | 文档/产物                                                             | 需修订内容                                                                                                                                                                                                                                                                                                       | Owner                            |
| :------ | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------- |
| S1      | `docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md`           | **r6**：① D-1 补「消费组件亦 colocate 于 webapp」；② §4 证据路径/行号；③ **AC-13「web 零可见变化」失效**；④ **C14/D2 补注「数据可信度走正交角标通道」**；⑤ §5 skill 偏离补注（迁入行亦为 `<li>`）；⑥ R8/R9 补注；⑦ **C5/AC-08 待 DP-6 裁定**；⑧ §10 互记一行                                                     | **arch**                         |
| S2      | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md` | **r7/r8**：① **C-60 ① 渲染退役**；② **C-60 ②③ 渲染点由内容区改为面板**（互斥穷尽与判定函数不变）；③ AC8/AC9 可测性口径改「二段式」；④ 边界③ `lastSyncAt` 措辞更正（P4）；⑤ §11 互记一行                                                                                                                          | **arch**（+ PM 确认措辞）        |
| S3      | `docs/prds/2026-09-23-web-offline-stage1.md`                          | ① **AC8 Then 修订**（零交互 = 指示；完整文案在面板）；② **AC9 Then 修订**（引导语在面板）；③ **AC13b 修订**（触顶零交互可见 = 通用文案角标；N 在面板）；④ 范围⑤ 渲染点改面板；⑤ 边界③ 更正；⑥ 登记 N-1 窄屏缺口（若 DP-6 = 替代 2）；⑦ 登记 DP-7a                                                                | **PM**                           |
| S4      | `docs/prds/2026-09-10-desktop-sync-status-rail-merge.md`              | ① **AC-13 口径修订**；② **AC-12 断言扩展**（`aria-label` 异常态 + live region 新增一档）；③ AC-11 补注（`::after` 角标不改盒）                                                                                                                                                                                   | **PM**                           |
| S5      | `docs/adr/README.md`                                                  | 索引行（r7 内容）+ 篇间关系 + 待拍板跟踪（DP-1/DP-3 关闭、DP-5 关闭、DP-6/DP-7a/DP-7b 新增）                                                                                                                                                                                                                     | **arch**                         |
| S6      | `docs/tasks-state.md`                                                 | T115/T115c 状态；`rd-fe-T115b` 已拦停 ⇒ 待本 ADR 修订后按新口径重新派发                                                                                                                                                                                                                                          | **PM**                           |
| S7      | 测试：`offline-status.test.ts` → 面板用例                             | 6 例**全部保留**（含「不得出现 null/1970」「两条独立不合并」「N=200 / N=0 退通用」）；新增 2 例：**在线+触顶** ⇒ alert 角标 + ⑤ 行；**离线+有镜像** ⇒ warn 角标 + ② 行                                                                                                                                           | **RD（T115b′）**                 |
| S8      | 测试：`sync-status-bar.test.ts` 随迁                                  | 4 例保持；补例：① `syncTimeSource='mirrorPulledAt'`；② 角标 `is-data-alert`/`is-data-warn` 取值；③ `aria-label` 异常态拼接；④ live region 新增档                                                                                                                                                                 | **RD（T115b′）**                 |
| S9      | 挂载点（DP-2=B）                                                      | 新增 `apps/web/src/WebRoot.vue`；`apps/web/src/main.ts` 改挂 `WebRoot`；**desktop `AppRoot.vue` 仅改 import 路径**；`index.vue` **移除** `<offline-status />` 与 import                                                                                                                                          | **RD（T115b′）**                 |
| S10     | `packages/presentation/offline` 使用面                                | 零改动（仅调用点迁移）                                                                                                                                                                                                                                                                                           | **RD**                           |
| S11     | 全范围门禁 + desktop Electron 冒烟 + 窄屏（≤445px）复验               | 逐项给数字/退出码；窄屏按 DP-6 结论验                                                                                                                                                                                                                                                                            | **RD/QA**                        |
| **S12** | `docs/prds/2026-09-23-web-offline-stage1.md`（**banner 裁定连带**）   | ① **AC10 措辞**：「可见提示」= **写被拦截时 `NueMessage`**（**非**常驻横幅；登记「离线态不再常驻可见提示」+ 轨道指示补位 + 窄屏例外）；② **AC17 措辞**：「可关闭不阻塞（非模态）」→ **首启 `NueConfirm` 一次性确认**（模态；Esc 不计已读）；③ 范围⑤/边界⑥ i18n 要求补「键不增不删」；④ §4.5 明文告知承载形态改写 | **PM**                           |
| **S13** | `docs/reports/defect-pool.md`                                         | 登记：① **DEF（布局）**「内容区头部多兄弟块 ⇒ 底部被遮住」的**根因待复现留痕**（用户反馈 #1 的直接诱因；即使 banner 已移出，仍须确认 `router-view` 容器 flex 是否需修，防复发）；② 若窄屏 DP-6 取「接受缺口」⇒ 登记为**已知能力缺口**                                                                            | **PM**（根因证据由 **RD** 提供） |
| **S14** | `docs/tasks-state.md`                                                 | T115/T115c 状态 + **T115b 实现现状对齐**（见 §13 注）+ DP-6/DP-8 待拍板                                                                                                                                                                                                                                          | **PM**                           |
| **S15** | `packages/presentation/offline/index.ts` + 孤儿文件                   | 移除 `OfflineReadOnlyBanner` 导出 + 删除 `read-only-banner.vue`（+ `__tests__/read-only-banner.test.ts`）；删除 `plaintext-notice-banner.vue`（+ 其测试中 banner 相关用例）                                                                                                                                      | **RD（T115b，并行）**            |
| **S17** | **收口确认（r9）**                                                    | S15 项**已交付**（读码核实：三文件 + 导出已删除）；`offline.readOnlyBanner` 键成为**无渲染点的键**（**保留**，与 `offline.freshness.updated` 同列）；`offline.readOnlyHint` **仍被 write-gate 使用**（不孤儿）                                                                                                   | ✅ 已交付（**PM 抽查**）         |
| **S16** | `apps/web/src/components/offline/*` 残留                              | r7 落地时删除 `offline-status.vue` / `use-mirror-status.ts`；`use-mirror-loaded-count.ts` 移入 `apps/web/src/hooks/`；`offline/index.ts` 去 `OfflineStatus` 导出                                                                                                                                                 | **RD（T115b′）**                 |

---

## 11. 风险清单（含应对）

| #        | 风险                                                                  | 影响                                                                                              | 应对                                                                                                              |
| :------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| R-1      | **窄屏 web/desktop 抽屉分支无同步状态**（N-1 / P6）                   | AC8/AC9/AC13b 在 ≤445px 不可验                                                                    | **DP-6** 裁定（推荐「抽屉也绑定注入点」）；若不修 ⇒ PRD 登记已知缺口                                              |
| R-2      | 二段式可见性被误判为「静默降级」                                      | 用户/QA 认为需求未满足                                                                            | **§5 逐条显式登记** + PRD 修订（S3）+ 回执中明确列出 N-1/N-2                                                      |
| R-3      | 角标 `::after` 引发布局/裁切回归                                      | AC-02/AC-11 失败                                                                                  | 伪元素 + 盒内定位（`top:1px; right:1px`）；QA 复测按钮/齿轮 rect **逐位一致**                                     |
| R-4      | 角标与颜色同为 error 色 ⇒ 语义混淆                                    | 用户不知「是推不上去还是数据旧」                                                                  | 通道④ 文案区分（「同步 · 尚未同步完成…」vs「同步 · 失败 N」）；面板内分行呈现                                     |
| R-5      | 顶部条移除后，DP-7a/7b 仍在头部 ⇒ **用户口径未完全达成**              | 用户仍见「底部被遮住」                                                                            | **§7 显式登记**；建议先由 rd-fe 复现布局根因（可能是布局 bug 而非组件问题），再决定删/修                          |
| R-6      | 迁入行非 `<li>` ⇒ 非法 HTML                                           | SHELL-02 AC-11 / C12                                                                              | §3.2 结构约束 + S1⑤ 补注；测试断言 `<li>` 包裹                                                                    |
| R-7      | `use-mirror-status.ts` 删除后漏改引用                                 | 构建失败                                                                                          | codegraph 已核：唯一消费者为 `offline-status.vue`（+ `index.ts` 导出）⇒ S9 一并处理                               |
| R-8      | `syncTimeSource` 误用（web 传 `lastSync`）                            | 截断时谎报新鲜度                                                                                  | 默认值 = desktop 行为；web 挂载点显式传 `'mirrorPulledAt'` + S8① 单测锁死                                         |
| R-9      | 面板行数增加（+5 行）导致面板过高、触及视口溢出回退                   | 纵向对齐漂移（SHELL-02 R13 已由 `transparent:true` 消除，但溢出仍会回退对齐）                     | 面板总高仍建议 `max-height` + 滚动（SHELL-02 R13 建议项）；**不新增浮层/z-index**                                 |
| **R-10** | 移除只读横幅后，**窄屏（≤445px）离线态零交互不可见**（与 N-1 叠加）   | AC10 的「离线可见性」在窄屏只剩「拦截时 toast」                                                   | **DP-6**（若取「抽屉也注入」⇒ 补位恢复）；否则在 PRD 显式登记                                                     |
| **R-11** | `NueConfirm` 首启**模态阻塞**与 AC17 原文「不阻塞」冲突               | 用户/QA 按旧措辞判缺陷                                                                            | **PRD AC17 措辞修订**（S12②）+ 本 ADR §8.3 显式登记；替代方案（`NueMessage`）已给出                               |
| **R-12** | **「底部被遮住」的布局根因未定位**（用户反馈 #1 的诱因）              | 移出 banner 后若根因在 `router-view` 容器 flex ⇒ **后续任何头部内容会复发**；且无法证明「修好了」 | 由 rd-fe **复现 + 留痕**（`<nue-content fill style="overflow:hidden">` 内多兄弟块的高度分配）；记入缺陷池（S13①） |
| **R-13** | **`views/index/index.vue` 是 T115b 与 T115b′ 的公共写点**（同一 cwd） | 两写者并行 ⇒ 改动互相覆盖/提交冲突                                                                | **PM 必须串行或明确分工**（见 §12 DP-9 / 回执）；提交纪律 `git commit --only <paths>` + 提交前核对 index          |

---

## 12. 待拍板决策点（**不替 PM 拍板**）

| ID        | 议题                                                                                               | 选项                                                                                                                                    | arch 建议                                                                                                                                                                         | 状态                                                        |
| :-------- | :------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| ~~DP-1~~  | 顶部面两端共用 ⇒ 删面是否波及 desktop                                                              | A 两端生效 / B 端门控                                                                                                                   | **A**                                                                                                                                                                             | ✅ **已由用户裁定关闭**（「头部不挂载任何组件」⇒ 两端一致） |
| DP-2      | 挂载点（避免 desktop 双份渲染）                                                                    | **B 端各自挂载点**（web 新增 `WebRoot.vue`，显式传 `'mirrorPulledAt'`；desktop 仅改 import 路径）/ A 单一挂载点（共享视图内注入端差异） | **B**                                                                                                                                                                             | ⏳ 待 PM                                                    |
| ~~DP-3~~  | ②③④⑤ 是否迁入面板                                                                                  | A 保留原位 / B 全部迁入                                                                                                                 | **B**                                                                                                                                                                             | ✅ **已由用户裁定关闭**（用户原话）                         |
| DP-4      | 窄屏（≤445px）无 rail 宿主 ⇒ 无同步面板                                                            | A 接受 / B 本单补抽屉注入点                                                                                                             | **B**（见 DP-6）                                                                                                                                                                  | ⏳ 待 PM                                                    |
| ~~DP-5~~  | C-60 ① 措辞 + ②③ 渲染点                                                                            | A 退役 + 迁入面板 / B 保留原位                                                                                                          | **A**                                                                                                                                                                             | ✅ **已由用户裁定关闭**                                     |
| **DP-6**  | **N-1**：抽屉分支（≤445px）是否也绑定 `railBottomHost`（使窄屏有同步状态）                         | A 绑定（修订 SHELL-02 C5/AC-08 + 抽屉几何回归）/ B 接受缺口（PRD 登记）/ C 抽屉 footer 内联状态文本                                     | **A**                                                                                                                                                                             | ⏳ **待 PM（新增，须用户知情：影响 SHELL-02 冻结条款）**    |
| **DP-7a** | 头部 `offline-read-only-banner`（AC10/C-59）是否移出                                               | —                                                                                                                                       | ✅ **已关闭（用户裁定 + RD 实证）**：移除 ⇒ **`NueMessage.warn`**（写被拦截时；web-only 拦截处触发；**非离线即弹**）—— **能力本就存在，无需新增代码**；组件文件与导出**已删除**   | ✅ 见 §8.2                                                  |
| **DP-7b** | 头部 `plaintext-notice-banner`（AC17）是否移出                                                     | —                                                                                                                                       | ✅ **已关闭（用户裁定 + RD 实测）**：移除 ⇒ **`NueConfirm`**（首启一次性确认；`unuseCancelButton` 原生支持；确认后写设备级标记）—— **真实 Chromium 实测通过**；组件文件**已删除** | ✅ 见 §8.3                                                  |
| **DP-8**  | **AC17 形态**：`NueConfirm` 为**模态**（阻塞交互直至确认）                                         | A 维持 `NueConfirm`（用户裁定）/ B 改 `NueMessage`（非阻塞但无「确认」语义）/ C `NueConfirm` + 任何关闭都计已读（`afterClose`）         | **A**（用户已裁定；PRD AC17 措辞随之修订）                                                                                                                                        | ⏳ 待 PM（仅措辞层面）                                      |
| **DP-9**  | **流程**：`views/index/index.vue` 同时被 T115b（banner）与 T115b′（移除 `<offline-status />`）修改 | A 串行（一方改完再动）/ B 一方一次性改完全部三点                                                                                        | **B**（一次改完三点，避免同文件双写者）                                                                                                                                           | ⏳ **待 PM 裁定**（**本项为阻塞项**：并行会互相覆盖）       |

---

## 13. 实施顺序（T115b′，单写者；每步可独立验证）

| 步  | 动作                                                                                                                                                                            | 验证（可量化）                                                                                                                                                                                                                                                                     |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | 迁移：组件 + 2 个 hook 进 webapp；`use-mirror-loaded-count` 移入 hooks 并去 `@/data-plane`；desktop `hooks/index.ts` 改 re-export；`AppRoot.vue` 改 import 路径                 | `pnpm exec vp check` = 0 error；`pnpm run desktop:build` exit 0                                                                                                                                                                                                                    |
| 1   | 挂载点（DP-2=B）：新增 `WebRoot.vue` + `main.ts` 改挂（显式传 `'mirrorPulledAt'`）；`index.vue` **移除** `<offline-status />`；删 `offline-status.vue` / `use-mirror-status.ts` | desktop Electron 冒烟：轨道按钮/齿轮几何与迁移前**逐位一致**（AC-01/02/07/11）；web 内容区顶部**零条**                                                                                                                                                                             |
| 2   | 面板内容：迁入 ②③④⑤ 为 `<li>` 行 + 通道③ 角标（`::after`）+ 通道④ 文案拼接（既有键）                                                                                            | `offline-status.test.ts` 6 例（迁移后）+ 2 新例全绿；`sync-status-bar.test.ts` 4 例 + 4 新例全绿                                                                                                                                                                                   |
| 3   | （若 DP-6=A）抽屉注入点                                                                                                                                                         | 窄屏 420px：轨道按钮存在（AC-08 口径修订后）                                                                                                                                                                                                                                       |
| 4   | 全范围门禁                                                                                                                                                                      | ① `pnpm exec vp check` 0 error；② 全仓 `pnpm exec vp test --run`（报**文件数/例数/红数**，0 红）；③ `pnpm run guard:ddd` exit 0；④ `pnpm exec vp run webapp build` + `pnpm run desktop:build` exit 0；⑤ `git status --porcelain -- packages/presentation-react apps/mobileapp` = 0 |

> **实现现状（r9，读码核实，供下一步派发起点）**：
>
> - ✅ **已完成**：步 0（组件 + 2 hook 迁入 webapp、desktop 改为 re-export/import 路径）、步 1 的**挂载点部分**（`WebRoot.vue` 已建、`main.ts` 已改挂、desktop 双文件已删）、**banner 裁定全部**（`read-only-banner.vue` / `plaintext-notice-banner.vue` + 测试 + 导出已删；`NueConfirm` 已接）。
> - ⏳ **待完成**：**§3–§6 的面板迁入**（②③④⑤ 作为 `<li>` 行）+ **§4 角标通道**（`::after` + `aria-label` 拼接）+ **删除 `offline-status.vue` / `use-mirror-status.ts`** + `use-mirror-loaded-count` 移入 hooks + **移除 `index.vue` 的 `<offline-status />`** + 测试迁移/补例。
> - ⚠️ **已知偏差**：当前 `offline-status.vue` 被实现为 **r6 口径**（保留条 + 根 `v-if` 门控，仅删 ①）⇒ **r7 要求进一步删除该条**（其逻辑全部迁入面板）。
> - ⚠️ **写者冲突**：`index.vue` 已被 T115b 修改（banner）⇒ **移除 `<offline-status />` 必须与之串行或由同一方一次改完**（R-13 / DP-9）。

---

## 14. 变更管理

1. 本 ADR 为 T115/T115c 评审基线；实现期偏离 §1–§9 任一裁决 → 回到架构评审（口头同意不计）。
2. SHELL-02 **C1–C16 行为约束继续有效**；本 ADR 修订其**落点/口径描述**，并**新增**「数据可信度走正交角标通道」补注（§4.3）；C5/AC-08 待 DP-6。
3. C-60 的**判定函数**（`resolveFreshness` / `formatMirrorPulledAt` / `resolveCoverageHints`）**不得**在本次改动中被改写；仅**渲染点迁移**（内容区 → 面板）与 ① 退役。
4. 用户裁定（T115c）优先于 PM 原 DP-1/DP-3/DP-5；若后续再改交互定稿 ⇒ 本 ADR 追加修订行 + 更新 SHELL-02 C14 补注。
5. 归档：本 ADR 落 `docs/adr/`，索引与篇间关系见 `docs/adr/README.md`；日期取评审终签日（2026-09-23）。

### 修订记录

| 版本   | 日期           | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| r6     | 2026-09-23     | 首次成文（T115）：D-1 组件迁入 webapp；D-2 同一组件 + `syncTimeSource`；D-3 **仅删 ①**（②③④⑤ 保留原位）；DP-1…DP-5；更正 PM 4 处落点事实                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **r7** | **2026-09-23** | **用户裁定变更设计（T115c）**：**D-3 改为「顶部零挂载 + ②③④⑤ 全部迁入面板」**（用户原话：所有同步状态都在状态组件里展示 + 头部不挂载任何组件，会破坏内容区可视）；**新增 D-4 状态→指示形态映射表 + 与 C14/D2 的优先级合并规则（角标正交通道）**；**新增 D-5 AC8/AC9/AC13b 二段式满足论证 + N-1/N-2 显式降级项与替代方案**；**新增 D-6 `offline-status.vue` 删除 + i18n 键不增不删落实**；**新增 D-7 头部其余 2 个组件待裁定（含本单首次登记的 `plaintext-notice-banner`/AC17）**；DP-1/DP-3/DP-5 关闭，新增 DP-6/DP-7a/DP-7b；连带清单扩至 S1–S11                |
| **r8** | **2026-09-23** | **用户裁定追加范围（T115c）**：「不要使用 banner，改为 `NueMessage` 或 `NueConfirm`」⇒ **D-7 由待裁定转为已裁定**；**新增 §8 D-8：头部零挂载完整口径（三个挂载点全部移除）+ AC10 修订论证（拦截时 `NueMessage` 为唯一提示时机；`write-gate.test.ts` 既有 3 条断言零改动覆盖；轨道指示补位 + 窄屏例外）+ AC17 修订论证（`NueConfirm` 单按钮原生支持；两版 API/池行为等价证据 ⇒ C6′ 白名单扩展；Esc 走 cancel ⇒ 不记已读）+ desktop 端隔离确认（web-only 注入 ⇒ 写路径零变化）**；连带清单扩至 S12–S16；风险新增 R-10…R-13（含 **index.vue 公共写点阻塞项 DP-9**） |
| **r9** | **2026-09-23** | **RD 交付实证收口**：**DP-7a / DP-7b 关闭**（`read-only-banner.vue` + 测试 + `OfflineReadOnlyBanner` 导出**已删除** ⇒ ADR 改为**历史/已删除**口径；AC10 = **既有** write-gate 即时提示（**无需新增代码**）；AC17 `NueConfirm` **真实 Chromium + CDP 实测通过**：单按钮 + `nao.plaintextNoticeAck=1` + 零 console warn/error）；新增 **S17 收口确认**；补 **API 命名纪律**（**`NueMessage.warn`**，不存在 `NueMessage.warning`）；登记**实现现状**（`<offline-status />` 仍保留待面板落地后移除）                                                                 |