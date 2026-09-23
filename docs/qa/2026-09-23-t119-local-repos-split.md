# T119：拆分 `local-repos.test.ts`（关键路径）—— 结果：**单文件提速成立，全仓 wall 无收益**

- 日期：2026-09-23
- 角色：qa
- 提交：`9f919cb0`（仅测试文件；无生产代码改动）
- 环境：本机 4 核 · Node v24.20.0 · vitest 4.1.10 · jsdom 30.0.1（与 T118 同机）
- 范围：**只搬移测试**，不改断言、不改生产代码；59 例一个不少

---

## 一、结论（先看这里）

1. **拆分本身完全成立**：59 例 0 红，逐行核验「搬移前后非空行多重集完全一致」（VERBATIM）。
2. **单文件关键路径大幅下降**：`24.29s → 10.12s`（−58%，新瓶颈 = `local-task-repos.test.ts`）；4 个新文件合跑 **wall 26.76s → 14.51s（−46%）**。
3. **但全仓 wall 没有收益**：`90.0s → 92.66s（+1%，噪声级）`。**T118 方案 #2 的「全仓 −8~12%」估算被实测证伪。**
4. **根因 = T118 自己的主结论**：套件是**聚合工作量驱动**，不是调度/并行驱动。拆分为 4 个文件后：
    - 关键路径确实缩短（调度侧收益）；
    - 但**每文件新增固定成本**（transform/import 各重付一遍）⇒ 聚合工作量 **243.53s → 253.98s（+10.45s）**；
    - 两者相抵，wall 持平。**⇒ 只拆文件、不动 import/环境，不能降全仓 wall。**
5. **真正的杠杆仍是 T120a（深路径导入）**：全仓 `import` 聚合 **74.25s**（占聚合工作量 29%）且**每文件重付**；它才是「减少聚合工作量」。**T119 的负面结果反而强化了 T120a 的优先级。**

---

## 二、拆分方案与文件清单

原 `local-repos.test.ts`：**1109 行 / 12 describe / 59 例** → **4 个按域文件 + 1 个共享 helper**：

| 新文件                             | 内容（原 describe）                                                                              | 例数 | 单跑 Duration |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | ------------- |
| `local-project-repos.test.ts`      | LocalProjectRepoImpl · 软删过滤 · 偏好默认值 · 多用户数据隔离                                    | 13   | 8.35s         |
| `local-task-repos.test.ts`         | LocalTaskRepoImpl（CRUD/过滤/排序，原 23 例整块）                                                | 23   | **10.12s**    |
| `local-task-child-repos.test.ts`   | TaskCheckItem 排序 · TaskCheckItem 软删过滤 · TaskComment 软删过滤                               | 9    | 4.48s         |
| `local-tag-pomodoro-repos.test.ts` | LocalTagRepoImpl · PomodoroRecord 记录列表 · PomodoroRecord 累计时长 · PomodoroRepo 空串归档过滤 | 14   | 6.64s         |
| `local-repos-test-helpers.ts`      | 共享 `setup` / `switchUser` / `makeTaskVO`（非 `*.test.ts`，不被收集；先例 `legacy-cipher.ts`）  | —    | —             |

合计 **59 例**（13+23+9+14）。EOL 保持仓库约定的 **CRLF**（`.editorconfig`），`insert_final_newline = false` 亦保持。

**只搬移的证据**：`git show HEAD:<原文件>` 的 describe 主体非空行 vs 4 新文件的非 import 部分，`Counter` 多重集完全相等（858 vs 858，diff 为空）。

---

## 三、数字对比

### 3.1 单文件（同一棵树，HEAD `10d64c58`）

| 对象                              | wall       | Duration | transform | import | tests  |
| --------------------------------- | ---------- | -------- | --------- | ------ | ------ |
| 原 `local-repos.test.ts`（59 例） | **26.76s** | 24.54s   | 2.00s     | 2.62s  | 21.75s |
| 4 新文件**合跑**（59 例）         | **14.51s** | 12.15s   | 5.03s     | 7.26s  | 24.73s |

- 关键路径（单文件最长）：`24.29s → 10.12s`（**−58%**）。
- 4 文件合跑 wall：`26.76s → 14.51s`（**−46%**）。
- 注：`tests` 聚合反升 21.75→24.73s，是 4 文件并发争 3 worker 的 CPU 竞争所致（非新增用例）。

### 3.2 全仓 `pnpm exec vp test --run`（**一次**）

| 运行                                   | 文件数  | 例数 | 红数  | Duration | wall       | 分解（transform/import/tests/environment） |
| -------------------------------------- | ------- | ---- | ----- | -------- | ---------- | ------------------------------------------ |
| 前（T118 基线 `ea0336b5`，功能等价树） | 148     | 1254 | 0     | 89.5–90s | **90s**    | 16.59 / 69.82 / 82.05 / 75.07              |
| 后（本提交 `9f919cb0`）                | **151** | 1254 | **0** | 90.44s   | **92.66s** | 19.27 / **74.25** / 86.53 / 73.93          |

- 文件数 148 → 151（−1 原文件 +4 新文件；helper 非测试不计数）✅
- 例数 **1254 不变**、红 **0** ✅
- 聚合工作量 243.53s → 253.98s（**+10.45s**）；`253.98 / 3 worker = 84.7s` 理论下界 vs 90.4s wall（≈94% 利用率）⇒ **已贴近聚合工作量下界**。
- `ea0336b5..HEAD` 之间只有 docs 提交 + 本测试拆分 ⇒ 前后树功能等价，对比有效。

### 3.3 全范围门禁（5 项）

| 项             | 命令                                                                   | exit | 数字                                            |
| -------------- | ---------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| 格式+lint+类型 | `pnpm exec vp check`                                                   | 0    | 1393 文件格式 OK；1190 文件 0 warning/lint/type |
| 全仓测试       | `pnpm exec vp test --run`                                              | 0    | 151 文件 / 1254 例 / 0 红                       |
| 领域隔离       | `pnpm run guard:ddd`                                                   | 0    | OK                                              |
| webapp build   | `pnpm exec vp run webapp build`                                        | 0    | built in 15.61s                                 |
| desktop build  | `pnpm run desktop:build`                                               | 0    | built in 20.84s                                 |
| 移动端红线     | `git status --porcelain -- packages/presentation-react apps/mobileapp` | 0    | **0** 行                                        |

---

## 四、影响面与风险

- ⛔ 未改任何生产代码；未改任何断言（多重集 VERBATIM 已证）。
- ⛔ 未并发跑全仓（跑前 `ps` 确认 vitest 进程 = 0；`intercom list` 无其它会话跑全仓）。
- 影响面：仅 `packages/infrastructure/src/persistence-local/__tests__/`。**未用 `codegraph affected`** —— 本次是「测试文件自身重组」，受影响面 = 被拆文件本身，直接以**全仓一次**覆盖（强于 affected 推断）。
- 无造数/探针：`setup()` 为既有测试夹具（清空 fake-indexeddb 表），非本次新增；不涉生产数据。
- 风险：**低**。若 PM 判定「收益不达标」⇒ 一条命令可回退（`git revert 9f919cb0` 或 `git reset`）。

---

## 五、建议 / 待 PM 决策

1. **保留还是回退 T119？**
    - **建议保留**：单文件/受影响面迭代提速 2.5×（`26.8s→14.5s`；单文件 `10.1s`），测试按域更易维护，门禁全绿、例数不变；全仓 wall 持平（非负收益）。
    - 若 PM 以「全仓 wall 必须下降」为唯一验收口径 ⇒ 应回退，因为拆分**无法**降 wall。
2. **T120a 是否继续？** 建议**继续且优先**：全仓 `import` 聚合 **74.25s** 是当前最大单项可消除成本，且 T118 已证「barrel 全层导出 × `isolate:true` ⇒ 每文件重付 ~2.6s」。它直接减少**聚合工作量**，是唯一能降 wall 的杠杆。

---

## 六、复现命令

```text
# 单文件基线（拆分前）
pnpm exec vp test --run packages/infrastructure/src/persistence-local/__tests__/local-repos.test.ts

# 4 文件合跑
pnpm exec vp test --run packages/infrastructure/src/persistence-local/__tests__/local-{project,task,task-child,tag-pomodoro}-repos.test.ts

# 全仓
pnpm exec vp test --run
```