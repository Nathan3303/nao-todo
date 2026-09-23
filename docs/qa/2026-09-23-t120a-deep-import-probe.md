# T120a：测试侧深路径导入 —— 结论：**收益不明显，建议不做**（真杠杆是 T120b）

- 日期：2026-09-23
- 角色：qa
- 状态：**小样本已实测并回退**（工作区干净，无提交）
- 前置：T119（`9f919cb0`）· T118 剖析（`63cecabe`）
- 纪律：先做 ~5 文件小样本，收益不明显即停并报告 —— **已按此执行**

---

## 一、结论（先看这里）

1. **受控探针**显示 barrel 确实贵：`@nao-todo/shared` barrel **import 2.07–2.79s** vs 深路径 **53–88ms**；`@nao-todo/domain-task` barrel **468–611ms** vs 深路径 **78–129ms**。
2. **但真实文件收益远小于探针**：5 文件样本 stash 对照 3× → 中位数 **Duration 11.86s → 10.65s（−10%）· import 8.89s → 8.18s（−8%，−0.7s）**。
3. **根因**：**生产侧仍然引 barrel** —— 测试侧改深路径**无法消除**已被生产闭包拉入的 barrel：
    - `@nao-todo/shared` barrel 的非测试引用方：`infrastructure` **29** · `presentation` **112** · `apps/web` **93** · `desktop` **5**（`domain-task` **0**）
    - `@nao-todo/domain-task` barrel 的非测试引用方：`infrastructure` **8** · `presentation` **54** · `apps/web` **45**（`domain-task` **0**）
4. **真正可受益面极窄**：51 个引 barrel 的测试文件中，**仅 21 个是 value 导入**（其余 30 个 `import type`，运行时零成本）；21 个里**只有 4 个 `packages/domain-task` 包内测试**的生产闭包不含 barrel ⇒ 每个省 ~0.35s ⇒ **合计 ~1.4s 聚合 ≈ ≤0.5s wall（<0.3%）**。
5. ⇒ **T120a 达不到 T118 的「import 聚合腰斩 / −20~30s wall」估算。建议不做。** 唯一能消除这些 barrel 的是**生产侧**改造（**T120b**，arch 评审中）。

---

## 二、受控探针：barrel vs 深路径（同内容 trivial 测试，仅换 import 说明符）

| 探针                   | import（2 次）   | Duration（2 次） | transform（2 次） |
| ---------------------- | ---------------- | ---------------- | ----------------- |
| `domain-task` barrel   | 476 / 468ms      | 790 / 645ms      | 417 / 412ms       |
| `domain-task` **deep** | 126 / 129ms      | 365 / 327ms      | 94 / 104ms        |
| `shared` barrel        | **2.22 / 2.79s** | **2.42 / 2.97s** | 1.78 / 2.21s      |
| `shared` **deep**      | 57 / 88ms        | 240 / 261ms      | 40 / 71ms         |

- 单文件 barrel 增量：`shared` **≈ +2.2~2.7s import**；`domain-task` **≈ +0.34~0.35s import**。
- 探针文件已删除（`zz-probe-*.test.ts`），`git status` 复核为空。

---

## 三、真实文件小样本 A/B（stash 对照，各 3 次）

样本（5 文件 / 79 例）：

1. `packages/domain-task/src/application/usecases/__tests__/converters.test.ts`（domain-task barrel）
2. `packages/domain-task/src/application/usecases/__tests__/task-check-item.test.ts`（domain-task barrel）
3. `packages/infrastructure/src/persistence-local/__tests__/local-task-repos.test.ts`（domain-task + shared）
4. `packages/infrastructure/src/persistence-local/__tests__/deletion-wipe.test.ts`（shared）
5. `apps/web/src/components/search/__tests__/aside.test.ts`（shared，jsdom）

| 状态   | Duration（3 次）       | 中位数     | import（3 次）      | 中位数    |
| ------ | ---------------------- | ---------- | ------------------- | --------- |
| BEFORE | 11.80 / 11.86 / 12.24s | **11.86s** | 8.89 / 9.06 / 8.86s | **8.89s** |
| AFTER  | 10.65 / 10.95 / 9.98s  | **10.65s** | 8.75 / 8.18 / 6.86s | **8.18s** |

⇒ **中位数 delta：Duration −1.21s（−10.2%）· import −0.71s（−8.0%）**。
逐文件看，收益集中在 2 个 `domain-task` 包内文件（~0.35s/个）；3 个 `infrastructure`/`apps/web` 文件**在噪声内**（其生产闭包已引 barrel）。

> ⚠️ 单次运行曾显示「import 2.84s → 0.99s / 合计 −4.5s」——经 stash 3× 对照校正为**冷缓存假象**，非真实收益。**单次跑不可用于结论。**

小样本改动（仅 import 说明符，未动任何断言）已 **`git checkout` 回退**，工作区干净。

---

## 四、影响面更正（相对 PM 派发单 / T118 估算）

| 项                                     | 派发单/T118 | 实测                                          |
| -------------------------------------- | ----------- | --------------------------------------------- |
| 引 barrel 的测试文件（去重）           | —           | **51**                                        |
| 其中 `@nao-todo/domain-task`           | 41          | **42**                                        |
| 其中 `@nao-todo/shared`                | 16/17       | **16**                                        |
| 其中 `@nao-todo/presentation-identity` | 2           | **2**                                         |
| **有 value 导入（唯一有运行时成本）**  | —           | **21**（其余 30 个仅 `import type` ⇒ 零成本） |
| **生产闭包不含 barrel ⇒ 真可受益**     | —           | **4**（均在 `packages/domain-task`）          |

- `packages/presentation-react` 的 2 处 `domain-task` 导入为 **`import type`**（零成本），且该包属**移动端红线**，未触碰。
- 深路径示例：`@nao-todo/domain-task/src/domain/entities/task` · `@nao-todo/shared/valueobjects/query-options` · `@nao-todo/shared/locales/i18n`（均通过 `vp check` 类型校验）。

---

## 五、建议 / 待 PM 决策

1. **不做 T120a**（测试侧深路径）——全量收益 ≤0.5s wall（<0.3%），代价是 ~21 文件改公共 API 之外的深路径（可维护性/脆弱性成本），**性价比不成立**。
2. **T120b 是唯一真杠杆**：把 **生产侧** 的 `@nao-todo/shared` barrel（29+112+93 处引用）与 `@nao-todo/domain-task` barrel（8+54+45 处）改为深路径/按需导出，才能让**测试与生产同时**摆脱整层导入。这与 T118「减少聚合工作量」的唯一有效路径一致。
3. 若 PM 仍希望拿下那 4 个 `packages/domain-task` 测试的 ~1.4s 聚合（~0.5s wall）：可做，但收益与 churn 不成比例，**建议并入 T120b 一起做**。

---

## 六、复现命令

```text
# 受控探针（同内容，仅换 import 说明符）：barrel vs deep
pnpm exec vp test --run <probe-barrel.test.ts>
pnpm exec vp test --run <probe-deep.test.ts>

# 真实文件 A/B（stash 对照）
git stash push -- <5 files> ; for i in 1 2 3; do pnpm exec vp test --run <5 files>; done
git stash pop             ; for i in 1 2 3; do pnpm exec vp test --run <5 files>; done

# 生产侧 barrel 引用面
grep -rl "from '@nao-todo/shared'" <area> --include='*.ts' --include='*.vue' | grep -v __tests__
grep -rl "from '@nao-todo/domain-task'" <area> --include='*.ts' --include='*.vue' | grep -v __tests__
```