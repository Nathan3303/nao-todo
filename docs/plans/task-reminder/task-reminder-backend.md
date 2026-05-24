# 任务提醒推送方案

## 概述

基于现有 Cron 框架，实现任务到期提醒的定时扫描与推送。支持**单次提醒**、**重复提醒**（每天/每周/每月）、**稍后提醒**（snooze），提醒时刻可配置。

## 数据库设计

### 字段变更

task 表已有 `remind_at`（单次提醒时间），新增 3 个字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `remind_at` | DATETIME NULL | NULL | 已存在。下一次触发时间，单次提醒直接用此字段 |
| `remind_repeat` | TINYINT | 0 | 0=不重复, 1=每天, 2=每周, 3=每月 |
| `remind_time` | VARCHAR(5) | NULL | "HH:mm" 格式，提醒的具体时刻 |
| `remind_weekdays` | TINYINT | 0 | 位掩码，bit0(1)=周日..bit6(64)=周六，仅 weekly 时有效 |

### 位掩码映射

```text
bit:  6    5    4    3    2    1    0
     周六 周五 周四 周三 周二 周一 周日
```

示例：每周一三五 = bit1 | bit3 | bit5 = 2 + 8 + 32 = 42

### 索引

- `idx_task_remind_at` — 已存在，用于 cron 扫描

## 核心逻辑

### Cron 扫描流程

每分钟执行一次：

1. 查询 `remind_repeat != 0 AND remind_at <= NOW()` 的任务
2. 对每条记录：推送通知 → 计算下一次触发时间 → 更新 `remind_at` 或清除重复规则

### 下一次触发时间计算

```text
func nextFire(from time.Time, repeat int8, remindTime string, weekdays int8):
    解析 remindTime → hour, minute
    today = 今天的 hour:minute 时刻

    switch repeat:
        daily:   return today + 1天
        weekly:  向后扫描 1~7 天，返回第一个匹配 weekdays 的日期
        monthly: return today + 1月

    如果 nextFire > end_at 或 weekdays 无匹配：
        return nil → 清除 remind_repeat
```

### 与任务周期的关系

```text
  start_at ───────── end_at
     │                  │
     │  09:00  09:00   │    ← remind_time=09:00, repeat=daily
     │    ●      ●     │
     └─────────────────┘
                        ↑ 超出 end_at，停止重复
```

- `remind_at` 早于 `start_at`：前端创建时校验 `remind_at >= start_at`
- `end_at` 为空：视为无限期，直到手动关闭

### 稍后提醒（Snooze）

不新增字段，核心逻辑是**用 snooze 目标时间覆盖 `remind_at`**，原始重复规则保持不变。

**流程：**

```text
09:00  提醒触发（每日提醒 09:00）
         ↓ 用户点"稍后10分钟"
09:02  POST /tasks/:id/snooze → remind_at = 09:12
         ↓
09:12  提醒触发 → 用户点"完成"
         ↓
       cron 用原始规则计算 next_fire → 明天 09:00
```

**接口：**

```text
POST /api/tasks/:taskId/snooze

Request:
{
    "durationMinutes": 10   // 必填，1~1440（1分钟~24小时）
}

Response:
{
    "code": 40000,
    "message": "稍后提醒已设置",
    "data": {
        "remindAt": "2026-05-17T09:12:00+08:00"
    }
}
```

**后端逻辑：**

```text
// 伪代码
func Snooze(taskId, userId, durationMinutes int64):
    task = repo.FindById(taskId)
    校验 task.UserId == userId
    校验 durationMinutes in 1~1440  // 上限24小时，防止异常输入
    task.RemindAt = NOW() + durationMinutes
    repo.UpdateRemindAt(task)
```

**关键点：**

- snooze 不改变 `remind_repeat` / `remind_time` / `remind_weekdays`，只修改 `remind_at`
- 单次提醒（`remind_repeat = 0`）同样支持 snooze
- 单次提醒 snooze 触发后，cron 将 `remind_at` 置 NULL
- 可以反复 snooze，无次数限制

### Cron 扫描完整流程

```text
每分钟：
  SELECT * FROM task
  WHERE remind_at <= NOW()
    AND remind_at IS NOT NULL
    AND deleted_at IS NULL

  对每条记录：
    1. hub.Publish(userId, event)    // 通过 SSE 推送
    2. 如果 remind_repeat != 0：
         next = CalculateNextRemindAt(NOW(), repeat, remindTime, remindWeekdays)
         如果 next != nil 且 (end_at IS NULL OR next <= end_at)：
           UPDATE remind_at = next
         否则：
           UPDATE remind_repeat = 0, remind_at = NULL  // 超出周期，停止
    3. 如果 remind_repeat == 0（单次提醒）：
         UPDATE remind_at = NULL  // 单次触发后清除
```

### 推送通道：SSE

选择 SSE（Server-Sent Events）而非轮询或 WebSocket：

- 提醒是纯服务端→客户端单向推送，SSE 天然匹配
- 浏览器原生 `EventSource` API，自动重连，前端零依赖
- 场景负载低（个人项目），goroutine + channel 完全够用
- 不需要额外建通知存储表或引入 WebSocket 库

**架构：**

```
Cron Job → hub.Publish(userId, event)
              │
              ▼
          Hub (内存)
              │ 按 userId 路由
              ▼
          SSE channel → Gin handler → 浏览器 EventSource
```

**Hub 单例（infrastructure/sse/hub.go）：**

```go
type Hub struct {
    clients map[int64]map[chan []byte]struct{} // key: userId
    mu      sync.RWMutex
}

func (h *Hub) Publish(userId int64, event []byte)   // cron 调用
func (h *Hub) Subscribe(userId int64) chan []byte     // SSE handler 调用
func (h *Hub) Unsubscribe(userId int64, ch chan []byte) // 连接断开时调用
```

**SSE Handler（interfaces/controllers/sse.go）：**

```go
func (c *SSEController) ReminderStream(ctx *gin.Context) {
    userId := context.GetUserId(ctx)

    // 设置 SSE 响应头
    ctx.Header("Content-Type", "text/event-stream")
    ctx.Header("Cache-Control", "no-cache")
    ctx.Header("Connection", "keep-alive")

    ch := hub.Subscribe(userId)
    defer hub.Unsubscribe(userId, ch)

    ctx.Stream(func(w io.Writer) bool {
        select {
        case event := <-ch:
            ctx.SSEvent("reminder", event)
            return true
        case <-ctx.Done():
            return false
        }
    })
}
```

**路由注册**：`GET /api/sse/reminders`，JWT 鉴权后通过 userId 订阅。

**前端接入**：

```js
const es = new EventSource('/api/sse/reminders')
es.addEventListener('reminder', (e) => {
    const data = JSON.parse(e.data)
    new Notification(data.taskName, { body: data.description })
})
```

## 各层变更

### 1. domain 层

**entities/task.go** — 新增 3 个字段：

```go
RemindRepeat  int8
RemindTime    string
RemindWeekdays int8
```

**valueobjects/createTask.go** — 新增对应字段。

**valueobjects/updateTask.go** — 新增对应字段（指针类型，支持部分更新）。

**service/taskService.go** — 新增方法：`CalculateNextRemindAt(task *Task) *time.Time`，负责计算下次触发时间。

### 2. infrastructure 层

**persistence/models/task.go** — 新增 3 个 GORM 字段，AutoMigrate 自动建列。

**persistence/task/converters.go** — 补全 model ↔ entity 映射（同时补上已有的 `RemindAt` 和 `ParentTaskId` 漏映射问题）。

**sse/hub.go** — 新建 SSE Hub 单例，管理 userId → channel 的映射，提供 `Publish` / `Subscribe` / `Unsubscribe`。

### 3. application 层

**application/task/appImpl.go** — 创建/更新任务时处理提醒字段的转换与校验。

**application/task/converters.go** — VO ↔ Entity 转换加入新字段。

### 4. interfaces 层

**controllers/task.go** — Create/Update/Get 接口接入新字段，新增 `Snooze` handler。

**controllers/snooze.go** — 新建（或合并到 task.go），处理 `POST /tasks/:taskId/snooze`。

**types/task.go** — 请求/响应类型新增：

```go
// CreateTaskReq / UpdateTaskReq
RemindAt       string `json:"remindAt"`
RemindRepeat   string `json:"remindRepeat"`   // "none"|"daily"|"weekly"|"monthly"
RemindTime     string `json:"remindTime"`     // "09:00"
RemindWeekdays []int  `json:"remindWeekdays"` // [1,3,5] 周一三五

// GetTaskRes 同理加出参
```

**types/snooze.go** — 新建：

```go
type SnoozeTaskReq struct {
    DurationMinutes int `json:"durationMinutes" binding:"required,min=1,max=1440"`
}

type SnoozeTaskRes struct {
    RemindAt string `json:"remindAt"`
}
```

**routers/taskRouter.go** — 新增路由 `POST /tasks/:taskId/snooze`。

**routers/sseRouter.go** — 新建，注册 `GET /api/sse/reminders`。

**controllers/sse.go** — 新建 SSE handler，从 Hub 订阅当前用户的提醒事件并通过 SSE 写出。

### 5. cron 任务

**infrastructure/cron/reminder.go** — 新建 cron job：

- 每分钟扫描到期提醒
- 调用 `hub.Publish(userId, event)` 推送 SSE 事件
- 更新 `remind_at` 或清除重复规则

**infrastructure/initialize.go** — `LoadCron()` 中实例化 Hub 并注册 cron job。

**SSE 事件格式：**

```json
{
    "type": "REMINDER",
    "taskId": "123456789",
    "taskName": "提交周报",
    "description": "每周五 17:00 前提交",
    "remindAt": "2026-05-17T09:00:00+08:00"
}
```

## 实施阶段

### 阶段一：数据层打通

- model 加字段
- domain entity / VO / converters 补全
- API 请求/响应类型更新
- 创建/更新/查询接口接入新字段
- Snooze 接口（controller + 路由 + 类型定义）

### 阶段二：Hub + SSE

- SSE Hub 单例实现（`Publish` / `Subscribe` / `Unsubscribe`）
- SSE handler + 路由注册
- `LoadCron` 中实例化 Hub

### 阶段三：扫描与推送

- `CalculateNextRemindAt` 逻辑实现
- cron 扫描任务，调用 `hub.Publish`

### 阶段四：边界处理与联调

- 前端 EventSource 接入 + 桌面通知
- 时区处理确认
- 边界 case 测试（跨天、跨月、end_at 到期自动停）
