---
description: 按需技能——QQ 主动推送（关键节点通知；PM 在里程碑/阻塞时读取）
---

# QQ 主动推送（qq-notify）

## 触发时机

**仅关键节点**由 PM 使用，读本文件确认纪律后调用；日常轮次不加载、不发送。
本能力**可选**：未配置 `pi-agent-qqbot` 时不要使用，按普通回执继续交付。

## 定位与能力边界

- 把「关键节点」用 QQ 官方机器人的**主动消息**推给 owner，让用户离开工位也能收到交付信号。
- **主动消息**（不带 `msg_id`）受 **QQ 开放平台账号权限与月度配额**限制：配额用尽或未开通对应权限时发送会失败（exit 3），**不得重试轰炸**。
- 只做**单向推送**，不做接收/被动回复；不做定时调度、不做退避重发（这些是平台与宿主的事）。
- **默认 sandbox**：`pi-agent-qqbot.json` 中 `sandbox: true` 走测试环境，`false` 才走 `prod`。**两者权限与收件人不通用**，切换 prod 前先确认机器人已在正式环境配置好。

## 何时用（四类节点，仅此四类）

| 节点 | 典型内容 |
| :--- | :--- |
| 批次进度汇总 | 一个批次开始/收尾时的整体进度（不是每个子任务） |
| 验收结论 | PM 验收通过 / 驳回，含 PR 编号与一句话结论 |
| 发版或合并完成 | tag / Release / squash 合并完成，含版本号 |
| 异常阻塞 | 需要用户决策、外部依赖卡住、门禁长期红 |

## 纪律（禁刷屏）

- **一个节点最多一条**；同一批次不逐任务推送。
- 推文用**一句话**：`[编号] 结论 + 关键数字/链接`，不贴长正文（正文留 `docs/`）。
- 用户未回应不重复推；阻塞未解除才允许在**跨天**时补一条。
- **默认 sandbox**，仅在正式发布通知用户时考虑 prod（须用户明确知情）。

## 调用禁令（⛔ 重要：曾因此误发过真实消息）

本脚本是 **Node 程序**，文件头部的注释里写着用法示例。⛔ **禁止用 shell 把它当 shell 脚本逐行解释**：

```text
⛔ bash .agents/scripts/qq-notify "文本"     ← 错：shell 会执行注释里的示例
```

原因（实测）：`bash <本脚本>` 会把注释当命令执行——注释里的 `*` 触发 **glob 展开**（把 `AGENTS.md apps docs …` 当命令跑）、`--to <openid>` 变成 **重定向**、`echo "文本" | qq-notify` 变成 **真实管道**（PATH 命中同名脚本即**真发**）——本仓历史上正因此误发过一条真实 QQ 消息。

**正确形式（三者等价，均 rc=0 且输出一致）**：

```bash
.agents/scripts/qq-notify "文本"      # ./ 直接执行（推荐）
node .agents/scripts/qq-notify "文本"  # 显式用 node
sh .agents/scripts/qq-notify "文本"    # 已加固：头部 exec 守卫自动转交 node
```

> 加固方式（v0.9.2）：第 1 行 `#!/bin/sh` + 第 2 行 `//bin/true; exec node "$0" "$@"`。
> `sh/bash` 执行时第 2 行即 `exec node`（**自动转交**，注释不会再被 shell 解析）；`node` 执行时第 2 行是 JS 注释。
> `nao-fleet.sh check` 已增加该守卫的存在性校验（缺失 ⇒ rc=1）。

## 用法

```bash
# 安装后位于当前项目：.agents/scripts/qq-notify
.agents/scripts/qq-notify "[T301] 验收通过 · PR #4 已合并 · v0.8.0"
.agents/scripts/qq-notify --dry-run "连通性自检"      # 只取 token、不发送
echo "文本" | .agents/scripts/qq-notify               # 从 stdin 读
.agents/scripts/qq-notify --to <openid> "文本"        # 指定收件人
.agents/scripts/qq-notify -h                          # 帮助
```

- 配置优先级：`--config <path>` > 环境变量 `QQ_NOTIFY_CONFIG` > `~/.pi/agent/pi-agent-qqbot.json`
- 配置文件字段：`{ "appId", "clientSecret", "ownerOpenId", "sandbox" }`；**无此文件即视为未启用本能力**（exit 1）。

## 退出码与失败回报

| 退出码 | 含义 | 处理 |
| :--- | :--- | :--- |
| `0` | 发送成功（或 `--dry-run` 取 token 成功） | 正常，可在回执记一行 `notify=ok` |
| `1` | 参数或配置错（缺文本 / 读不到配置 / 缺 `ownerOpenId`） | 按 stderr 的 `→` 提示修复；**不要重试**，先补配置 |
| `2` | 取 access token 失败（网络 / 凭证错误） | 报出 `status` 与截断错误体；不重试轰炸 |
| `3` | 发送失败（权限 / 配额 / openid 非法） | 报出 `status` 与截断错误体；主动消息受权限与配额限制 |

- 失败时**不抛栈**：脚本输出 `FAIL: …` 与一行可执行修复提示，**非 0 退出码 + 截断错误体**即为回报内容。
- 推送失败**不阻断交付**：把 `notify=fail(exit=<n>)` 写进回执的风险项，继续原流程。
- **安全**：脚本绝不打印/落盘 `clientSecret` 与 `access_token`；回执中也不要粘贴这两者。

## 跨项目用法

安装后脚本固定位于 **`<项目>/.agents/scripts/qq-notify`**（随 `nao-skill install/update` 整目录分发）。
在项目里直接用相对路径调用；从别的仓库操作时用绝对路径 `.agents/scripts/qq-notify`（可配 `NAO_SKILLS`）。
