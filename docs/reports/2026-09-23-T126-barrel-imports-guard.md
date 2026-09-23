# T126 · barrel 导入面可解析性守卫（正式门禁）

- 单号：`T126`（Owner: rd-be）｜commit：`632a2bc0`
- 交付：`scripts/guard-barrel-imports.mjs`（新增）+ `package.json`（`guard:barrel-imports`）
- 背景：`T123` W3a 实测暴露 `vp check` 真实盲区 —— `.vue` 内 type-only 导入不存在符号时 `vp check` 报 0 error，而 `tsc` 报 `TS2305`。本守卫把该盲区固化为正式门禁。

## 一、实现方式

纯静态（不依赖 TS / tsc），单文件 Node ESM 脚本，递归扫描全仓源码（1192 文件）：

1. **扫描面**：`.vue` / `.ts` / `.tsx` / `.mjs` / `.js` / `.mts` / `.cts`；跳过 `node_modules`、`dist`、`out`、`release`、`build`、`coverage`、`.codegraph`、`.agents`、`.pi`、`.vite-hooks`。字符串/注释感知的词法扫描（非裸正则），避免字面量误判。
2. **模块解析**：`@nao-todo/<pkg>` 与 `@nao-todo/<pkg>/<sub>` → 磁盘文件；包名→目录由 `packages/*`、`apps/*` 的 `package.json#name` 动态构建（不硬编码）；支持 `index.*` 目录桶、无扩展名、以及 TS ESM 惯例 `import './x.js'` 实际源码为 `./x.ts`。
3. **导出符号表**：`moduleExports()` 以文件为缓存（含环检测）展开 —— `export * from`（含 TS 5.0 `export type * from`）、`export * as ns from`、`export { A, B as C } (from)`、**局部 `export type { X }` 形式**、各类声明式导出、`export default`（`.vue` 恒有 default）。
4. **校验对象**：命名导入的**导入名**（`as` 左侧）、type-only 语句（`import type`、`import { type X }`、`export type { X } from`）、默认导入；`export { A as B } from '@nao-todo/*'` 按 `A` 校验。命名空间导入（`* as ns`）与副作用导入（`import '...'`）不校验符号。

> 设计取舍：`export { A } from './x'` 只登记「桶导出 A」，不回溯校验 x 是否真有 A —— 该类错误发生在 `.ts` 桶内、会被 `vp check` 捕获，不属本守卫要补的 `.vue` type-only 盲区。

## 二、负例实测（含输出）

### B1（T123 精确场景：`.vue` type-only 导入不存在符号）

临时文件 `__t126-negative__.vue`：

```vue
<script setup lang="ts">
import { type InnerDropdownOptionVO } from '@nao-todo/shared'

const options: InnerDropdownOptionVO[] = []
console.log(options)
</script>

<template>
    <div />
</template>
```

```
$ node scripts/guard-barrel-imports.mjs
[guard:barrel-imports] 扫描 1193 文件 · 校验 1246 条 @nao-todo 导入 / 1801 个命名
[guard:barrel-imports] 未解析导入 1 处：
  - __t126-negative__.vue: "InnerDropdownOptionVO" 不在 @nao-todo/shared
$ echo $?
1
```

⇒ 守卫 exit=1，**成功抓到 `vp check` 漏掉的场景**（`InnerDropdownOptionVO` 因 T123 W3a 已从 shared 根桶摘除，仅存在于 `@nao-todo/shared/components/inner-dropdown`）。

### B2（多形态负例 + 正例对照）

```
[guard:barrel-imports] 未解析导入 4 处：
  - __t126-negative2__.ts: "NotARealSymbol" 不在 @nao-todo/domain-task        # export { A as B } from
  - __t126-negative__.vue: "InnerDropdownOptionVO" 不在 @nao-todo/shared      # 根桶 type-only
  - __t126-negative__.vue: "TotallyMissingType" 不在 @nao-todo/shared/components   # import type {X}
  - __t126-negative__.vue: default 导入不存在 -> @nao-todo/shared/constants   # 默认导入无 default 的桶
$ echo $?
1
```

同一文件中正例对照 `import { type NaoSmartListLinkVO } from '@nao-todo/shared/components/smart-list'` **未误报** ⇒ 选择性生效。

### 恢复后

```
[guard:barrel-imports] 扫描 1192 文件 · 校验 1245 条 @nao-todo 导入 / 1800 个命名
[guard:barrel-imports] OK - 全仓 @nao-todo/* 命名导入（含 type-only）均可解析
$ echo $?
0
```

## 三、门禁实测（本批受影响面）

| 命令                            | exit | 输出                                           |
| ------------------------------- | ---- | ---------------------------------------------- |
| `pnpm exec vp check`            | 0    | 1397 文件格式正确；1192 文件无 lint/type 错误  |
| `pnpm run guard:ddd`            | 0    | OK                                             |
| `pnpm run guard:gate-pathspec`  | 0    | OK                                             |
| `pnpm run guard:barrel-imports` | 0    | 1192 文件 / 1245 条导入 / 1800 命名 / 0 未解析 |

防误报加固点（首版曾误报 146 处，均为守卫自身缺陷，已修）：

- TS 5.0 `export type * from`（`shared/types/index.ts` 等）；
- TS ESM `import './x.js'` → 实际 `./x.ts`（`presentation-identity` 组件桶链）；
- 局部 `export type { X }` 形式（`inner-dropdown/index.ts` 等）。

守卫耗时约 0.6s。

## 四、结论与建议

- **建议纳入「全范围门禁」第 ⑦ 项**（由 PM 决定并写入 `AGENTS.md`；本次未改 `AGENTS.md`）。
- 未过项：无。