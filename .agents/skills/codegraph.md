---
description: 按需技能——CodeGraph 代码定位（替代 grep 全文扫描，省 token）
---

# CodeGraph 代码定位

> 用图谱精确命中符号/调用链/影响面，**替代"grep 全文 + cat 大文件"**——上下文只进相关代码块。
> 不可用时降级到 `grep -rn` + 行段读取（见文末）。

## 何时用（对比 grep）

| 场景 | 首选 | 理由 |
| :--- | :--- | :--- |
| 定位函数/类型/符号定义 | `codegraph query` | 语义精确，一次命中 |
| 理解某任务涉及哪些代码 | `codegraph context "<任务>"` | 一次返回相关符号+代码块，无需多轮 grep+cat |
| 追踪调用链 / 改动影响面 | `callers` / `callees` / `impact` | 图谱遍历，替代手动读 N 个文件 |
| 找受影响的测试 | `codegraph affected` | 一步到位 |
| 文件名/配置/字符串/文档 | `grep -rn` | 更快更直接，不绕道 |

## Token 纪律（省的是上下文累积）

- **一次 `context` 拿全，不再 grep+cat 同一段代码**——codegraph 已给出精确代码块，直接使用。
- 输出过大用 `-n <num>` 限符号数；只看结构用 `--no-code`。
- 文件模式用 `node --file <f> --offset <n> --limit <m>` 只读需要的行段，**禁止 cat 全文**。
- 大任务拆成多个子问题分别 `context`，不做一次超大查询。
- 拿到的代码块不重复读取（同一内容第二次进上下文 = 重复计费）。

## 命令速查

- `codegraph status` — 索引健康检查（无索引 → `codegraph init`；有改动 → `codegraph sync`）
- `codegraph query "<符号>"` — 精确定位符号
- `codegraph context "<任务描述>"` — 任务上下文：相关符号 + 关系 + 代码块
- `codegraph node <符号>` — 符号源码 + caller/callee 调用链
- `codegraph node --file <f> --offset <n> --limit <m>` — 读文件行段（带行号）
- `codegraph callers <符号>` / `codegraph callees <符号>` — 调用追踪
- `codegraph impact <符号>` — 改动影响分析（**修改前必跑**）
- `codegraph affected <文件...>` — 受影响的测试文件
- `codegraph files` — 项目文件结构

## 工作区与索引维护

- 索引是**项目级**的：在对应 repo 目录跑（fleet 会话 cwd 即 repo）；跨仓库用 `-p <路径>`。
- 写完代码跑一次 `codegraph sync` 保持索引新鲜（提交前）。
- 首次进入新 repo：`codegraph status` → 无索引则 `codegraph init`（一次性成本，之后只 `sync`）。

## 降级（codegraph 不可用 / 无结果）

1. 无 `.codegraph/` → 先 `codegraph sync`；仍失败则 `codegraph init`（慢则放弃）。
2. 查询无结果 → 换关键词再试一次 → 仍无 → 回退。
3. **回退 grep**：`grep -rn "<关键词>" --include=<扩展名> <目录>` 定位，再用
   `sed -n '<起>,<止>p' <文件>` 读精确行段；**禁止 cat 全文**。
4. 非代码内容（配置/字符串/文档）直接 grep，不绕道。
