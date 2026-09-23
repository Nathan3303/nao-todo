# T125：T122 生产 bundle 体积对照（pre = `92c153b2^`，post = `4a75c214`）—— 结论：**生产侧无体积收益（web +845 B · desktop +18 B）**

- 日期：2026-09-23
- 角色：qa
- 状态：**纯测量已完成**（未改任何代码；仅新增本报告）
- 前置：T122（`92c153b2`，生产侧收窄 import 面 W1+W2）· ADR `2026-09-23-barrel-import-surface-narrowing.md` §8 未过项②
- 纪律：`git worktree add /tmp/t125-pre 92c153b2^` 取父提交；**pre 与 post 均在 `/tmp/t125-pre` worktree 内构建，未在主工作区做任何构建/检出**；构建期间**未并发跑全仓测试**；测量脚本全部位于 `/tmp`，未落仓

---

## 一、结论（先看这里）

| #   | 问题                                      | 结论                                                                                                                                                                                                                                                                                       |
| :-- | :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **W1/W2 是否带来生产侧体积收益？**        | **无。** web `apps/web/dist` 总量 **5,574,941 → 5,575,786 B（+845 B，+0.0152%）**；desktop `apps/desktop/out` 总量 **5,654,951 → 5,654,969 B（+18 B，+0.0003%）**。**是微增，不是减少**（不做美化）。                                                                                      |
| Q2  | 首屏（entry + `modulepreload`）是否受益？ | **无。** web 首屏 JS **864,816 → 865,680 B（+864 B，+0.10%）**；desktop **712,758 → 712,776 B（+18 B）**。`modulepreload` 名单**条目数不变**（web 31 / desktop 11），组成集合**完全一致**（仅顺序/哈希变化）。                                                                             |
| Q3  | 生产侧到底有没有可测的结构变化？          | **有，但不是收益：** web bundle 模块图**减少 17 个模块**（`packages/infrastructure` 74 → 57），**全部是 `renderedLength = 0` 的纯 re-export barrel 文件**（`index.ts` 等）⇒ **图变窄了，但 0 字节收益**（本就被 Rollup tree-shake 掉）。                                                   |
| Q4  | 为什么总量反而 +845 B？                   | ① **chunk 重排**：`js/offline` **−41,848 B**、`js/hooks` **+41,102 B**、`js/router` **+1,612 B**（≈41 KB 模块在既有 chunk 间迁移，净 +866 B）；② 其余 16 个 chunk 合计 **−21 B**（多为 −1 B）；③ 无 chunk 新增/删除（js 87 / css 38 文件数不变），**1 处改名**（`context2` → `context`）。 |
| Q5  | 对 ADR 的判定                             | ADR §0 Q2 的「**生产构建侧 ≈ 0（Rollup tree-shake）**」由**推定**升级为**实测确认**；§8 **未过项②可以关闭**（结论 = 无收益）。                                                                                                                                                             |

---

## 二、方法（可复现）与可信度

### 2.1 取数与构建

```text
git worktree add /tmp/t125-pre 92c153b2^      # pre（无 T122）
pnpm install --frozen-lockfile                # lockfile 在 pre..HEAD 之间无差异（已核实）
pnpm --filter @nao-todo/webapp build          # pre：✓ built in 20.42s（rc=0）
pnpm --filter @nao-todo/desktopapp build      # pre：✓ built in 35.54s（rc=0）
git -C /tmp/t125-pre checkout --detach 4a75c214   # post（含 T122，复用同一 node_modules）
rm -rf apps/web/dist apps/desktop/out
pnpm --filter @nao-todo/webapp build          # post：rc=0
pnpm --filter @nao-todo/desktopapp build      # post：rc=0
```

- **pre 侧代码确认为「无 T122」**：`packages/infrastructure/src/persistence-sync/sync-service.ts:8` 为 `from '@nao-todo/shared'`（barrel）；post 侧同一行为 `from '@nao-todo/shared/requester'`（窄叶）。
- 两 commit 之间 `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` **无差异**（`git diff --stat` 为空）⇒ 复用同一 `node_modules` 不引入变量。

> ⚠️ **测量时点与隔离说明（重要）**：本单按派单要求，**post = `4a75c214`**（派单时的 HEAD，即 T122 验收提交）。测量期间主工作区 HEAD 已被**其他 worker 推进**（`af692240` → `f928327f` → `a82aa9e3` → `48ebc09e` → `ba986745` = T123 W3a），且工作区存在 **T123 W3b 在制改动**（约 174 个文件，测量时段内仍在持续写入）⇒ **若直接在主工作区构建，测到的会是 T123 而非 T122**。本单**pre 与 post 都在 worktree 内以固定 commit 检出构建**，正是为了与在制工作区隔离；**post 侧结论 = T122 相对其父提交的净效果**，不含 T123/T124 及之后的生产改动。

### 2.2 构建确定性（先证明，再比较）

| 侧   | 同 commit 两次构建 | 结果                                                               |
| :--- | :----------------- | :----------------------------------------------------------------- |
| pre  | `edef09b3` ×2      | `dist` 与 `out` **文件名单/大小/字节内容全部一致**（`diff -r` 空） |
| post | `4a75c214` ×2      | 同上（第二次 post 构建产物与首次**逐字节相同**）                   |

⇒ 产物是**确定性**的：pre 与 post 之间的任何差异**只能**来自两 commit 之间的源码差异，不存在构建噪声。

### 2.3 归因受控 A/B（确认差异确实来自 T122 的生产改动）

在临时 worktree 上，把 T122 的 **24 个生产文件**（`git diff --name-only edef09b3 92c153b2 | grep -v '\.test\.ts$'`）**逐个回退到 pre 版本**（保留 HEAD 的 14 个测试 mock 改动），重建 webapp：

```text
结果：dist 与 pre（edef09b3）构建产物【逐字节完全一致】（diff -r 空）
```

⇒ ① 观察到的全部差异**完全归因于 T122 的 24 个生产源文件改动**；② **14 个测试 mock 改动对生产产物零影响**（符合预期）。

### 2.4 口径

- 统计对象：`apps/web/dist` 与 `apps/desktop/out` 的**产物文件**；**排除** `.gz`/`.br` 预压缩旁车（`nao-precompress` 生成）与 `stats.html`（`rollup-plugin-visualizer` 生成，落在包根、不在产物目录内），旁车单列。
- 文件配对：**按 Vite 内容哈希（8 字符）join**（哈希相同 ⇒ 内容相同，已逐字节复核），避免按「去哈希文件名」配对时多实例 base name（`entry.*`/`header.*`/`main.*`/`index.*`）产生的错配。覆盖 125 个 js/css 中的 122 个（未覆盖的 3 个是 `public/` 直出的 `fonts/{pf,poppins,iconfont}/*.css`，无哈希且两侧同名同大小）；非哈希资源（图片/字体/html）按「同名 + 同大小」比对。

---

## 三、总量对照

### 3.1 `apps/web/dist`

| 分组               | pre 文件数 | post 文件数 |  pre 字节 | post 字节 |   Δ 字节 | Δ%           |
| :----------------- | ---------: | ----------: | --------: | --------: | -------: | :----------- |
| **总量**           |        265 |         265 | 5,574,941 | 5,575,786 | **+845** | **+0.0152%** |
| js                 |         87 |          87 | 1,166,117 | 1,166,962 |     +845 | +0.0724%     |
| css                |         38 |          38 |   359,340 |   359,340 |        0 | 0%           |
| 其他静态资源       |        140 |         140 | 4,049,484 | 4,049,484 |        0 | 0%           |
| ├ woff2            |        124 |         124 | 2,018,364 | 2,018,364 |        0 | 0%           |
| ├ png              |          3 |           3 | 1,173,404 | 1,173,404 |        0 | 0%           |
| ├ webp             |         11 |          11 |   853,078 |   853,078 |        0 | 0%           |
| ├ html             |          1 |           1 |     4,117 |     4,117 |        0 | 0%           |
| └ ico              |          1 |           1 |       521 |       521 |        0 | 0%           |
| 旁车 `.gz`（单列） |          — |           — |   448,864 |   449,603 |     +739 | +0.16%       |
| 旁车 `.br`（单列） |          — |           — |   382,135 |   383,066 |     +931 | +0.24%       |

**web：只有 js 变化（+845 B），CSS 与全部静态资源 0 变化。**

### 3.2 `apps/desktop/out`

| 分组         | pre 文件数 | post 文件数 |  pre 字节 | post 字节 |  Δ 字节 | Δ%           |
| :----------- | ---------: | ----------: | --------: | --------: | ------: | :----------- |
| **总量**     |        258 |         258 | 5,654,951 | 5,654,969 | **+18** | **+0.0003%** |
| js           |        114 |         114 | 1,275,642 | 1,275,660 |     +18 | +0.0014%     |
| css          |          4 |           4 |   331,546 |   331,546 |       0 | 0%           |
| 其他静态资源 |        140 |         140 | 4,047,763 | 4,047,763 |       0 | 0%           |

**desktop：全部变化 = entry chunk `renderer/assets/index-*.js` 的 +18 B。**

---

## 四、首屏（entry + `modulepreload`）对照

| 指标                   |     web pre |    web post |                                      web Δ | desktop pre | desktop post | desktop Δ |
| :--------------------- | ----------: | ----------: | -----------------------------------------: | ----------: | -----------: | --------: |
| `modulepreload` 条目数 |          31 |          31 |                                          0 |          11 |           11 |         0 |
| `modulepreload` 字节   |     854,614 |     855,477 |                                       +863 |     491,754 |      491,754 |         0 |
| entry chunk 字节       |      10,202 |      10,203 |                                         +1 |     221,004 |      221,022 |       +18 |
| **首屏 JS 合计**       | **864,816** | **865,680** |                                   **+864** | **712,758** |  **712,776** |   **+18** |
| 首屏集合差异           |             |             | **无**（去哈希后集合完全一致，仅顺序变化） |             |              |    **无** |

⇒ **首屏没有变轻，也没有变重到有意义的程度**（web +0.10%，desktop +0.0025%）。

---

## 五、Top 10 chunk 明细（按字节，js）

### 5.1 web `apps/web/dist/js/**`

| #   | pre                                        |    字节 | post                                   |    字节 |           Δ |
| :-- | :----------------------------------------- | ------: | :------------------------------------- | ------: | ----------: |
| 1   | `js/vender/nue-ui.BEPQqJdi.js`             | 168,627 | 同左（哈希相同）                       | 168,627 |           0 |
| 2   | `js/shared.BiddJdlJ.js`                    | 136,587 | 同左（哈希相同）                       | 136,587 |           0 |
| 3   | `js/task.C13EaBMk.js`                      | 124,112 | `js/task.moozOPmI.js`                  | 124,112 |           0 |
| 4   | `js/vender/dexie@4.4.5.CBZ_xiSf.js`        |  96,814 | 同左（哈希相同）                       |  96,814 |           0 |
| 5   | `js/offline.BxTSX-9U.js`                   |  90,026 | `js/offline.B4_8vNfm.js`               |  48,178 | **−41,848** |
| 6   | `js/vender/axios@1.20.0_…CGXZmvLH.js`      |  50,467 | 同左（哈希相同）                       |  50,467 |           0 |
| 7   | `js/presentation-identity.B9cEgRfM.js`     |  42,523 | `js/presentation-identity.DKTT-Ycu.js` |  42,523 |           0 |
| 8   | `js/pomodoro.CULk7rtW.js`                  |  41,586 | 同左（哈希相同）                       |  41,586 |           0 |
| 9   | `js/entry.B5QkUUg_.js`                     |  34,600 | `js/entry.CfhAzi4m.js`                 |  34,599 |          −1 |
| 10  | `js/vender/@intlify_core-base@11.4.10.…js` |  32,690 | 同左（哈希相同）                       |  32,690 |           0 |
| —   | （新进榜）`js/hooks.D24lTTrd.js`           |  18,016 | `js/hooks.Csghntam.js`                 |  59,118 | **+41,102** |
| —   | （新进榜）`js/router.DkOOJRcu.js`          |  11,556 | `js/router.CJPeAKx3.js`                |  13,168 |  **+1,612** |

### 5.2 desktop `apps/desktop/out/renderer/assets/**`

| #   | pre                                    |    字节 | post                                   |    字节 |   Δ |
| :-- | :------------------------------------- | ------: | :------------------------------------- | ------: | --: |
| 1   | `index-BBti6cMo.js`（entry）           | 221,004 | `index-jNp_ghyd.js`（entry）           | 221,022 | +18 |
| 2   | `vender/nue-ui-DJZdishI.js`            | 171,481 | 同左（哈希相同）                       | 171,481 |   0 |
| 3   | `vender/vue-ecosystem-B2lk6veD.js`     | 105,135 | 同左（哈希相同）                       | 105,135 |   0 |
| 4   | `vender/dexie@4.4.5-CkIMl9p3.js`       |  96,607 | 同左（哈希相同）                       |  96,607 |   0 |
| 5   | `use-task-comment-usecase-CWyd5in5.js` |  62,133 | `use-task-comment-usecase-CkaJvAnV.js` |  62,133 |   0 |
| 6   | `index-CRyOXzKd.js`                    |  51,825 | `index-CIG7KNIY.js`                    |  51,825 |   0 |
| 7   | `vender/axios@1.20.0_…fm2qWOBP.js`     |  50,818 | 同左（哈希相同）                       |  50,818 |   0 |
| 8   | `entry-BTV4QrBs.js`                    |  35,460 | `entry-CuDxwru0.js`                    |  35,460 |   0 |
| 9   | `kanban-view-adapter-u-Iox0w3.js`      |  31,009 | `kanban-view-adapter-r-bsMTW1.js`      |  31,009 |   0 |
| 10  | `vender/vue-router-Bo2RCaOp.js`        |  23,067 | 同左（哈希相同）                       |  23,067 |   0 |

---

## 六、chunk 级差异：**无 chunk 消失/合并，1 处改名，1 处大规模重排**

### 6.1 文件数（是否消失/合并）

| 侧      | pre js | post js | pre css | post css | 结论                 |
| :------ | -----: | ------: | ------: | -------: | :------------------- |
| web     |     87 |      87 |      38 |       38 | **无新增/删除/合并** |
| desktop |    114 |     114 |       4 |        4 | **无新增/删除/合并** |

### 6.2 改名（1 处，内容相同）

| pre                       | post                     | 字节 | 内容                                        |
| :------------------------ | :----------------------- | ---: | :------------------------------------------ |
| `js/context2.Bx2dGUPj.js` | `js/context.Bx2dGUPj.js` |   50 | **逐字节相同**（仅 chunk 命名去重序号差异） |

### 6.3 内容变化的 chunk：39 个（web）/ 82 个（desktop）

- **web**：39 个 chunk 哈希变化；其中 **20 个字节数完全不变**，**19 个有字节变化**：
    - 主要：`offline` **−41,848**、`hooks` **+41,102**、`router` **+1,612**；
    - 其余 16 个合计 **−21 B**（−1 B ×10、−3、−4、−5、−5、+5、+1）。
    - 字节数不变却内容变化的原因（已核实）：差异**只出现在内嵌的 chunk 文件名清单**（`__vite__mapDeps` 的 `d.f=[...]`），例如 `js/task.*.js` 首处差异即在 `"js/creator.DuE26GIu.js"` → `"js/creator.hsp5Nc_9.js"`（长度相同）。
- **desktop**：82 个 chunk 哈希变化，**其中 81 个字节数完全相同，仅 entry +18 B**。差异同样**只是内嵌 chunk 文件名**，例如 `use-task-comment-usecase-*.js` 首处差异为 `from"./index-BBti6cMo.js"` → `from"./index-jNp_ghyd.js"`。
    - desktop 侧 `stats.html` 模块级数据同时确认：**模块数 1,083 → 1,083、renderedLength 2,619,761 → 2,619,761（0 变化）**；仅 2 个 SFC 的 `?vue&type=style&scoped=<hash>` 模块 id 变化（0 字节，因 T122 改了这两个 SFC 的 `<script setup>` ⇒ scoped 哈希变化）。
- 归因：**desktop 的 82 处哈希变化是「entry chunk 改名 → 引用它的 chunk 内嵌名变化 → 再级联」的纯哈希级联，不是代码增减。**

### 6.4 重排的实质（谁搬到了哪里，来自 `stats.html` 模块级数据）

| chunk（web）      | pre 模块数 / renderedLength | post 模块数 / renderedLength | 迁移内容                                                                                                                           |
| :---------------- | --------------------------: | ---------------------------: | :--------------------------------------------------------------------------------------------------------------------------------- |
| `js/offline.*.js` |             103 / 163,163 B |                49 / 88,045 B | **移出** `infrastructure/src/persistence-local/repos/*-repo-impl.ts`、`built-in/project/default.ts` 等                             |
| `js/hooks.*.js`   |               56 / 34,428 B |               90 / 106,555 B | **移入**上述 `persistence-local/repos/*`（`task-repo-impl` 11,570 B、`project-repo-impl` 5,323 B、`pomodoro-repo-impl` 4,487 B …） |
| `js/router.*.js`  |               11 / 10,616 B |                14 / 13,745 B | **移入** `persistence-local/deletion/{deletion-service,local-storage-policy}.ts`                                                   |

- 三者**均在首屏 `modulepreload` 名单内** ⇒ 该重排对首屏构成无影响，只是把 ≈41 KB 从 `offline` 挪到 `hooks`（净 −746 B），并给 `router` 加了 1,612 B。

---

## 七、模块级证据（`rollup-plugin-visualizer` stats）：图确实变窄了，但收益为 0

| 侧       | 模块数 pre → post | renderedLength pre → post       | 说明                                                            |
| :------- | :---------------: | :------------------------------ | :-------------------------------------------------------------- |
| web      | **1,200 → 1,183** | 2,231,938 → 2,232,076（+138 B） | **−17 个模块，全部来自 `packages/infrastructure`（74 → 57）**   |
| ├ infra  |      74 → 57      | 138,049 → 138,118               | **移除的 17 个模块 `renderedLength` 全为 0**（纯 re-export 桶） |
| └ shared |     176 → 176     | 203,522 → 203,591               | 数量不变                                                        |
| desktop  | **1,083 → 1,083** | 2,619,761 → 2,619,761（0）      | 模块图**零变化**                                                |

被移出 web bundle 的 17 个模块（全部 0 字节，纯桶）：

```text
packages/infrastructure/index.ts
packages/infrastructure/src/built-in/index.ts
packages/infrastructure/src/built-in/project/index.ts
packages/infrastructure/src/persistence-go/index.ts
packages/infrastructure/src/persistence-go/{fallback,identity,pomodoro,project,tag,task}/index.ts
packages/infrastructure/src/persistence-local/index.ts
packages/infrastructure/src/persistence-local/{converters/user.ts,migration/plaintext-migration.ts}
packages/infrastructure/src/persistence-local/repos/{user-repo-impl.ts,user-config-repo-impl.ts}
packages/infrastructure/src/persistence-sync/{epoch.ts,index.ts}
```

⇒ **W1/W2 在生产侧确实把「不必要的桶」从图里拿掉了（图更干净），但这些桶本来就是 0 字节的 re-export 中转 ⇒ 体积收益为 0。** 这正是 ADR「生产构建侧 ≈ 0（Rollup tree-shake）」预测的机制。

---

## 八、结论与 ADR §8 未过项②

1. **W1/W2 没有带来生产侧体积收益**：web **+845 B（+0.0152%）**、desktop **+18 B（+0.0003%）**；首屏 **+864 B / +18 B**。**方向是微增**，量级可忽略但**不是收益**。
2. 唯一可测的生产侧结构收益是**模块图收窄**（web infra 74 → 57，−17 个 0 字节桶；**对体积的影响为 0 字节**），**不构成体积/首屏收益**。
3. ⇒ **ADR §8 未过项②（「生产构建侧收益未实测」）现可关闭，结论 = 无收益（实测，非推定）**。ADR §0 Q2「生产构建侧 ≈ 0」判定**成立**。
4. 附带发现（不影响结论，但值得记录）：
    - T122 的生产 import 改写**改变了 chunk 归属**（`offline` ↔ `hooks` 迁移 ≈41 KB，`router` +1,612 B），文件数与首屏集合不变；**净字节 +866 B** 由此而来。
    - 构建**完全确定性**（同 commit 两次构建逐字节相同）；**测试 mock 改动对生产产物零影响**（受控 A/B 已证）。

---

## 九、未过项 / 残留（诚实登记）

- ① **未做真实网络传输/运行时性能测量**（如首屏 LCP、解压后传输量、真机加载）—— 本单只对照**产物体积**；`.gz`/`.br` 旁车已单列（+739 B / +931 B），未做 HTTP 层对照。
- ② **未量化「chunk 重排」对缓存命中率的影响**：`offline`/`hooks`/`router` 三个 chunk 哈希均变，理论上会使已缓存用户重新下载这 ≈120 KB；本单只报告体积，**未评估缓存收益/损失**（属发布策略问题，非体积问题）。
- ③ **构建 wall 时间不可比**（构建期另有 worker 在制，CPU 争用）：web `20.42s / 29.12s / 27.78s / 18.47s`、desktop `35.54s / 36.65s / 28.54s / 24.95s` 抖动明显 ⇒ **不作为任何判据**（本单亦未据此下结论）。
- ④ **未跑全范围门禁**：本单**零代码改动**（仅新增本报告），故除本报告自身的 `vp check <file>` 格式校验、以及 **9 次构建（含 1 次受控 A/B 重建）全部 `rc=0`** 之外，**未跑**全仓 `vp check` / 全仓 `vp test` / `guard:ddd` / 双端 build 门禁。
- ⑤ 测量环境为**本机 linux-x64 / pnpm 11.18.0 / 同一 `node_modules`**；产物哈希与体积随依赖版本变化，跨环境复现需固定 lockfile（本次 pre/post 共用同一 lockfile）。
- ⑥ **post 侧不含 T123/T124 及之后的生产改动**（见 §2.1 时点说明）：若 T123 W3a/W3b 落地后再测一次，其生产体积收益预期同样需单独实测（本单不覆盖）。

---

## 附录 A：web 内容变化的 39 个 chunk（哈希变更）

```text
字节变化（19 个，合计 +845 B）：
  +41102  js/hooks.D24lTTrd.js                     18016 -> 59118   js/hooks.Csghntam.js
   +1612  js/router.DkOOJRcu.js                    11556 -> 13168   js/router.CJPeAKx3.js
      +5  js/sign-in-page.DHfNnQj7.js                586 -> 591     js/sign-in-page.CNp8d7hZ.js
      +1  assets/index-Z1F7ozNm.js                 10202 -> 10203   assets/index-CZTNMdxx.js
      -1  js/entry.B5QkUUg_.js                     34600 -> 34599   js/entry.CfhAzi4m.js
      -1  js/entry.Ct7U46pd.js                     10109 -> 10108   js/entry.CtegxkFx.js
      -1  js/entry.DN2SU5KP.js                      7688 -> 7687    js/entry.B7sEvmrh.js
      -1  js/entry.kNeFBNAw.js                      4435 -> 4434    js/entry.Dw4ARD5j.js
      -1  js/header.CLMPx0cV.js                     5302 -> 5301    js/header.CVZLeVGt.js
      -1  js/header.Co78s6ol.js                     5166 -> 5165    js/header.CxOqbC_a.js
      -1  js/header.DRAMHMSP.js                     5006 -> 5005    js/header.B1mxf5XY.js
      -1  js/monthly.BjsxBnGZ.js                    9849 -> 9848    js/monthly.C-HLKve2.js
      -1  js/use-calendar-host.BoUpBT3m.js         21368 -> 21367   js/use-calendar-host.DvtXz6nV.js
      -1  js/weekly.B6sSW_Hy.js                    10114 -> 10113   js/weekly.BTu2EK5A.js
      -3  js/sign-out-broadcast.688jAL2H.js         1111 -> 1108    js/sign-out-broadcast.Cb2JzqS0.js
      -4  js/index.B_8YKb0N.js                     18985 -> 18981   js/index.D1DYXlE5.js
      -5  js/pomodoro.CjVeXQKz.js                  10907 -> 10902   js/pomodoro.eK6OASjg.js
      -5  js/sign-up-page.BkM0Lmr0.js                365 -> 360     js/sign-up-page.B7sVOjoI.js
     -41848  js/offline.BxTSX-9U.js                 90026 -> 48178   js/offline.B4_8vNfm.js

字节不变（20 个，差异仅内嵌 chunk 文件名）：
  js/built-in-project、js/check-in-page、js/creator、js/daily、js/entry.Dfs1seQX、
  js/main.BUDMlhes、js/main.CANDoNmK、js/main.D1ldaL7z、js/parent-selector、js/presentation-identity、
  js/project-manager、js/project-updater、js/project、js/tag-creator、js/tag-manager、js/tag-updater、
  js/tag、js/task-reminder、js/task、js/undo-sink
```

## 附录 B：desktop 内容变化的 82 个 chunk

```text
82 个（= 全部变化 chunk）：
  81 个：字节数完全相同，差异仅内嵌 chunk 文件名（如 "./index-BBti6cMo.js" -> "./index-jNp_ghyd.js"）
        └ 其中 1 个是 CSS：style-BjyMDs4L.css (214338 B) -> style-DIeEtdQI.css (214338 B)【0 B，scoped 哈希变化】
   1 个：renderer/assets/index-BBti6cMo.js (221004 B) -> index-jNp_ghyd.js (221022 B)  【+18 B，entry】
```

## 附录 C：复现脚本位置（均未落仓）

```text
/tmp/t125-collect.sh      产物体积/扩展名/旁车采集
/tmp/t125-diff2.mjs       按内容哈希 join 的产物差异对照
/tmp/t125-modules.mjs     stats.html 模块级（模块数 / renderedLength / 桶归属）对照
/tmp/t125-initial.mjs     index.html 首屏（entry + modulepreload）字节对照
/tmp/t125-chunkmods.mjs   单 chunk 的模块组成对照
/tmp/t125-raw/*.tsv       两侧逐文件 (size, path) 原始清单
/tmp/t125-artifacts/{pre,post}/  两侧产物快照（用于逐字节复核）
```