# Nao Todo Server API 文档

## 项目介绍

Nao Todo Server 是一个任务管理系统的后端服务，提供用户管理、项目管理、任务管理、标签管理、事件管理和评论管理等功能。

## 基础信息

- 基础 URL: `/api`
- 认证方式: JWT (Bearer Token)
- 响应格式: JSON
- 编码: UTF-8

## 响应格式

### 成功响应

```json
{
  "code": 10000,
  "message": "操作成功",
  "data": {},
  "pagination": {}
}
```

### 错误响应

```json
{
  "code": 10001,
  "message": "错误信息",
  "error": "详细错误描述"
}
```

## 认证接口 (/auth)

### 登录接口

**接口地址**: `POST /auth/signin`

**请求参数**:
```json
{
  "email": "string (必填)",
  "password": "string (必填)"
}
```

**响应数据**:
```json
{
  "jwt": "string (JWT Token)"
}
```

**返回码**:
- 10010: 登录成功
- 10011: 参数错误
- 10012: 登录失败

---

### 注册接口

**接口地址**: `POST /auth/signup`

**请求参数**:
```json
{
  "email": "string (必填)",
  "password": "string (必填)",
  "nickname": "string (可选)"
}
```

**响应数据**: 无

**返回码**:
- 10000: 注册成功
- 10001: 参数错误
- 10002: 注册失败

---

### 检查登录接口

**接口地址**: `PUT /auth/checkin`

**请求参数**:
```json
{
  "jwt": "string (必填)",
  "deviceType": "string (可选)"
}
```

**响应数据**:
```json
{
  "jwt": "string (新的 JWT Token)"
}
```

**返回码**:
- 10020: 检入成功
- 10021: 参数错误
- 10022: 检入失败

---

### 退出登录接口

**接口地址**: `DELETE /auth/signout`

**请求参数**:
```json
{
  "jwt": "string (必填)",
  "deviceType": "string (可选)"
}
```

**响应数据**: 无

**返回码**:
- 10030: 登出成功
- 10031: 参数错误
- 10032: 登出失败

---

### 验证 Token 接口

**接口地址**: `GET /auth/validate`

**认证方式**: 需要 JWT Token

**响应数据**:
```json
{
  "code": 10040,
  "message": "JWT 验证通过"
}
```

**返回码**:
- 10040: 验证通过
- 其他: 验证失败

## 用户接口 (/user)

需要 JWT 认证

### 获取用户信息

**接口地址**: `GET /user/profile`

**响应数据**:
```json
{
  "email": "string",
  "nickname": "string",
  "avatar": "string",
  "createdFrom": "string",
  "role": "string",
  "state": "int8",
  "config": "any",
  "createdAt": "string",
  "updatedAt": "string"
}
```

**返回码**:
- 10060: 获取成功
- 10065: 获取失败

---

### 更新用户昵称

**接口地址**: `PUT /user/nickname`

**请求参数**:
```json
{
  "nickname": "string (必填，2-32字符)"
}
```

**响应数据**: 无

**返回码**:
- 10050: 更新成功
- 10051: 参数错误
- 10052: 昵称长度不合法
- 10053: 更新失败

---

### 更新用户密码

**接口地址**: `PUT /user/password`

**请求参数**:
```json
{
  "oldPassword": "string (必填)",
  "newPassword": "string (必填，8-32字符)"
}
```

**响应数据**: 无

**返回码**:
- 10070: 更新成功
- 10071: 参数错误
- 10073: 密码长度不合法
- 10074: 更新失败

---

### 更新用户头像

**接口地址**: `PUT /user/avatar`

**支持格式**:
1. JSON 请求 (application/json): 通过 URL 更新
2. 表单请求 (multipart/form-data): 通过文件上传更新

**JSON 请求参数**:
```json
{
  "avatarURL": "string (必填)"
}
```

**响应数据**:
```json
{
  "avatarURL": "string"
}
```

**返回码**:
- 10080: 更新成功
- 10081: 参数错误
- 10082: 更新失败

---

### 激活用户

**接口地址**: `PUT /user/active`

**请求参数**:
```json
{
  "password": "string (必填)"
}
```

**响应数据**: 无

**返回码**:
- 10100: 激活成功
- 10101: 参数错误
- 10102: 激活失败

---

### 禁用用户

**接口地址**: `PUT /user/deactive`

**请求参数**:
```json
{
  "password": "string (必填)"
}
```

**响应数据**: 无

**返回码**:
- 10090: 禁用成功
- 10091: 参数错误
- 10092: 禁用失败

## 项目接口 (/projects)

需要 JWT 认证

### 获取项目列表

**接口地址**: `GET /projects`

**响应数据**:
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "archivedAt": "time.Time (null)",
    "createdAt": "time.Time",
    "updatedAt": "time.Time"
  }
]
```

**返回码**:
- 20070: 获取成功
- 20071: 获取失败

---

### 获取项目详情

**接口地址**: `GET /projects/:projectId`

**路径参数**:
- `projectId`: 项目 ID (必填)

**响应数据**:
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "archivedAt": "time.Time (null)",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 20000: 获取成功
- 20001: 参数错误
- 20002: 获取失败

---

### 创建项目

**接口地址**: `POST /projects`

**请求参数**:
```json
{
  "name": "string (必填)",
  "description": "string (可选)"
}
```

**响应数据**:
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "archivedAt": "time.Time (null)",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 20010: 创建成功
- 20011: 参数错误
- 20012: 创建失败

---

### 更新项目

**接口地址**: `PUT /projects/:projectId`

**路径参数**:
- `projectId`: 项目 ID (必填)

**请求参数**:
```json
{
  "name": "string (可选)",
  "description": "string (可选)"
}
```

**响应数据**:
```json
"项目 ID"
```

**返回码**:
- 20020: 更新成功
- 20021: 参数错误
- 20022: 项目 ID 为空
- 20023: 更新失败

---

### 删除项目

**接口地址**: `DELETE /projects/:projectId`

**路径参数**:
- `projectId`: 项目 ID (必填)

**响应数据**:
```json
"项目 ID"
```

**返回码**:
- 20030: 删除成功
- 20031: 参数错误
- 20032: 删除失败

---

### 恢复项目

**接口地址**: `PUT /projects/restore/:projectId`

**路径参数**:
- `projectId`: 项目 ID (必填)

**响应数据**:
```json
"项目 ID"
```

**返回码**:
- 20040: 恢复成功
- 20041: 参数错误
- 20042: 恢复失败

---

### 归档项目

**接口地址**: `PUT /projects/archive/:projectId`

**路径参数**:
- `projectId`: 项目 ID (必填)

**响应数据**:
```json
"项目 ID"
```

**返回码**:
- 20050: 归档成功
- 20051: 参数错误
- 20052: 归档失败

---

### 取消归档项目

**接口地址**: `PUT /projects/unarchive/:projectId`

**路径参数**:
- `projectId`: 项目 ID (必填)

**响应数据**:
```json
"项目 ID"
```

**返回码**:
- 20060: 取消归档成功
- 20061: 参数错误
- 20062: 取消归档失败

---

### 获取项目偏好

**接口地址**: `GET /projects/:projectId/preference`

**路径参数**:
- `projectId`: 项目 ID (必填)

**响应数据**:
```json
{
  "id": "string",
  "projectId": "string",
  "viewType": "string",
  "getTasksOptions": "string",
  "columns": "string",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 20080: 获取成功
- 20081: 参数错误
- 20082: 获取失败

---

### 保存项目偏好

**接口地址**: `POST /projects/:projectId/preference`

**路径参数**:
- `projectId`: 项目 ID (必填)

**请求参数**:
```json
{
  "viewType": "string",
  "getTasksOptions": "string",
  "columns": "string"
}
```

**响应数据**:
```json
"项目 ID"
```

**返回码**:
- 20090: 保存成功
- 20091: 参数错误
- 20092: 请求参数错误
- 20093: 保存失败

## 标签接口 (/tags)

需要 JWT 认证

### 获取标签列表

**接口地址**: `GET /tags`

**响应数据**:
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "color": "string",
    "createdAt": "time.Time",
    "updatedAt": "time.Time"
  }
]
```

**返回码**:
- 30040: 获取成功
- 30041: 获取失败

---

### 获取标签详情

**接口地址**: `GET /tags/:tagId`

**路径参数**:
- `tagId`: 标签 ID (必填)

**响应数据**:
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "color": "string",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 30000: 获取成功
- 30001: 参数错误
- 30002: 获取失败

---

### 创建标签

**接口地址**: `POST /tags`

**请求参数**:
```json
{
  "name": "string (必填)",
  "description": "string (可选)",
  "color": "string (必填)"
}
```

**响应数据**:
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "color": "string",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 30010: 创建成功
- 30011: 参数错误
- 30012: 创建失败

---

### 更新标签

**接口地址**: `PUT /tags/:tagId`

**路径参数**:
- `tagId`: 标签 ID (必填)

**请求参数**:
```json
{
  "name": "string (可选)",
  "description": "string (可选)",
  "color": "string (可选)"
}
```

**响应数据**:
```json
"标签 ID"
```

**返回码**:
- 30020: 更新成功
- 30021: 参数错误
- 30022: 请求参数错误
- 30023: 更新失败

---

### 删除标签

**接口地址**: `DELETE /tags/:tagId`

**路径参数**:
- `tagId`: 标签 ID (必填)

**响应数据**:
```json
"标签 ID"
```

**返回码**:
- 30030: 删除成功
- 30031: 参数错误
- 30032: 删除失败

---

### 获取标签偏好

**接口地址**: `GET /tags/:tagId/preference`

**路径参数**:
- `tagId`: 标签 ID (必填)

**响应数据**:
```json
{
  "id": "string",
  "tagId": "string",
  "viewType": "string",
  "getTasksOptions": "string",
  "columns": "string",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 30050: 获取成功
- 30051: 参数错误
- 30052: 获取失败

---

### 更新标签偏好

**接口地址**: `POST /tags/:tagId/preference`

**路径参数**:
- `tagId`: 标签 ID (必填)

**请求参数**:
```json
{
  "viewType": "string",
  "getTasksOptions": "string",
  "columns": "string"
}
```

**响应数据**:
```json
"标签 ID"
```

**返回码**:
- 30060: 更新成功
- 30061: 参数错误
- 30062: 请求参数错误
- 30063: 更新失败

## 任务接口 (/tasks)

需要 JWT 认证

### 获取任务列表

**接口地址**: `GET /tasks`

**查询参数**:
```
projectId: 项目 ID
tagId: 标签 ID
name: 任务名称
description: 任务描述
state: 任务状态
priority: 任务优先级
startAt: 开始时间
endAt: 结束时间
deletedAt: 删除时间
archivedAt: 归档时间
starMarkAt: 星标时间
givenUpAt: 放弃时间
isDeleted: 是否已删除 (bool)
isArchived: 是否已归档 (bool)
isStarMarked: 是否已星标 (bool)
isGivenUp: 是否已放弃 (bool)
page: 页码 (int)
limit: 每页数量 (int)
relativeDate: 相对日期
sort: 排序方式
```

**响应数据**:
```json
[
  {
    "id": "string",
    "parentTaskId": "string",
    "name": "string",
    "description": "string",
    "state": "string",
    "priority": "string",
    "startAt": "string",
    "endAt": "string",
    "tags": ["string"],
    "projectId": "string",
    "archivedAt": "string",
    "starMarkAt": "string",
    "givenUpAt": "string",
    "createdAt": "string",
    "updatedAt": "string",
    "deletedAt": "string"
  }
]
```

**返回码**:
- 40050: 获取成功
- 40051: 参数错误
- 40052: 获取失败

---

### 获取任务详情

**接口地址**: `GET /tasks/:taskId`

**路径参数**:
- `taskId`: 任务 ID (必填)

**响应数据**:
```json
{
  "id": "string",
  "parentTaskId": "string",
  "name": "string",
  "description": "string",
  "state": "string",
  "priority": "string",
  "startAt": "string",
  "endAt": "string",
  "tags": ["string"],
  "projectId": "string",
  "archivedAt": "string",
  "starMarkAt": "string",
  "givenUpAt": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "deletedAt": "string"
}
```

**返回码**:
- 40000: 获取成功
- 40001: 参数错误
- 40002: 获取失败

---

### 创建任务

**接口地址**: `POST /tasks`

**请求参数**:
```json
{
  "parentTaskId": "string",
  "name": "string (必填)",
  "description": "string",
  "state": "string (必填)",
  "priority": "string (必填)",
  "startAt": "string",
  "endAt": "string",
  "projectId": "string",
  "tags": ["string"]
}
```

**响应数据**:
```json
{
  "id": "string",
  "parentTaskId": "string",
  "name": "string",
  "description": "string",
  "state": "string",
  "priority": "string",
  "startAt": "string",
  "endAt": "string",
  "tags": ["string"],
  "projectId": "string",
  "archivedAt": "string",
  "starMarkAt": "string",
  "givenUpAt": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "deletedAt": "string"
}
```

**返回码**:
- 40010: 创建成功
- 40011: 参数错误
- 40012: 创建失败

---

### 更新任务

**接口地址**: `PUT /tasks/:taskId`

**路径参数**:
- `taskId`: 任务 ID (必填)

**请求参数**:
```json
{
  "parentTaskId": "string",
  "name": "string",
  "description": "string",
  "state": "string",
  "priority": "string",
  "startAt": "string",
  "endAt": "string",
  "projectId": "string",
  "tags": ["string"],
  "archivedAt": "string",
  "starMarkAt": "string",
  "givenUpAt": "string"
}
```

**响应数据**:
```json
"任务 ID"
```

**返回码**:
- 40020: 更新成功
- 40021: 参数错误
- 40022: 任务 ID 无效
- 40023: 更新失败

---

### 删除任务

**接口地址**: `DELETE /tasks/:taskId`

**路径参数**:
- `taskId`: 任务 ID (必填)

**响应数据**:
```json
"任务 ID"
```

**返回码**:
- 40030: 删除成功
- 40031: 参数错误
- 40032: 删除失败

---

### 恢复任务

**接口地址**: `PUT /tasks/restore/:taskId`

**路径参数**:
- `taskId`: 任务 ID (必填)

**响应数据**:
```json
"任务 ID"
```

**返回码**:
- 40040: 恢复成功
- 40041: 参数错误
- 40042: 恢复失败

## 事件接口 (/events)

需要 JWT 认证

### 获取事件列表

**接口地址**: `GET /events`

**响应数据**:
```json
[
  {
    "id": "string",
    "taskId": "string",
    "name": "string",
    "description": "string",
    "isDone": "bool",
    "sortId": "uint16",
    "createdAt": "time.Time",
    "updatedAt": "time.Time"
  }
]
```

**返回码**:
- 50040: 获取成功
- 50041: 获取失败

---

### 获取事件详情

**接口地址**: `GET /events/:eventId`

**路径参数**:
- `eventId`: 事件 ID (必填)

**响应数据**:
```json
{
  "id": "string",
  "taskId": "string",
  "name": "string",
  "description": "string",
  "isDone": "bool",
  "sortId": "uint16",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 50000: 获取成功
- 50001: 参数错误
- 50002: 获取失败

---

### 创建事件

**接口地址**: `POST /events`

**请求参数**:
```json
{
  "taskId": "string (必填)",
  "name": "string (必填)",
  "description": "string (可选)"
}
```

**响应数据**:
```json
{
  "id": "string",
  "taskId": "string",
  "name": "string",
  "description": "string",
  "isDone": "bool",
  "sortId": "uint16",
  "createdAt": "time.Time",
  "updatedAt": "time.Time"
}
```

**返回码**:
- 50010: 创建成功
- 50011: 参数错误
- 50012: 创建失败

---

### 更新事件

**接口地址**: `PUT /events/:eventId`

**路径参数**:
- `eventId`: 事件 ID (必填)

**请求参数**:
```json
{
  "name": "string (可选)",
  "description": "string (可选)",
  "isDone": "bool (可选)",
  "sortId": "uint16 (可选)"
}
```

**响应数据**:
```json
"事件 ID"
```

**返回码**:
- 50020: 更新成功
- 50021: 参数错误
- 50022: 请求参数错误
- 50023: 更新失败

---

### 删除事件

**接口地址**: `DELETE /events/:eventId`

**路径参数**:
- `eventId`: 事件 ID (必填)

**响应数据**:
```json
"事件 ID"
```

**返回码**:
- 50030: 删除成功
- 50031: 参数错误
- 50032: 删除失败

---

### 重新排序事件

**接口地址**: `PUT /events/resort`

**请求参数**:
```json
{
  "originalId": "string",
  "boundId": "string",
  "flag": "int"
}
```

**响应数据**:
```json
{
  "originalSortId": "uint16",
  "boundSortId": "uint16"
}
```

**返回码**:
- 50050: 排序成功
- 50051: 参数错误
- 50052: 排序失败

## 评论接口 (/comments)

需要 JWT 认证

### 获取评论列表

**接口地址**: `GET /comments`

**查询参数**:
- `taskId`: 任务 ID (必填)

**响应数据**:
```json
[
  {
    "id": "string",
    "taskId": "string",
    "content": "string",
    "attachments": ["string"],
    "isTopUp": "bool",
    "commentUser": {
      "avatar": "string",
      "nickname": "string"
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

**返回码**:
- 60040: 获取成功
- 60041: 参数错误
- 60042: 获取失败

---

### 获取评论详情

**接口地址**: `GET /comments/:commentId`

**路径参数**:
- `commentId`: 评论 ID (必填)

**响应数据**:
```json
{
  "id": "string",
  "taskId": "string",
  "content": "string",
  "attachments": ["string"],
  "isTopUp": "bool",
  "commentUser": {
    "avatar": "string",
    "nickname": "string"
  },
  "createdAt": "string",
  "updatedAt": "string"
}
```

**返回码**:
- 60000: 获取成功
- 60001: 参数错误
- 60002: 获取失败

---

### 创建评论

**接口地址**: `POST /comments`

**请求参数**:
```json
{
  "taskId": "string (必填)",
  "content": "string (必填)"
}
```

**响应数据**:
```json
{
  "id": "string",
  "taskId": "string",
  "content": "string",
  "attachments": ["string"],
  "isTopUp": "bool",
  "commentUser": {
    "avatar": "string",
    "nickname": "string"
  },
  "createdAt": "string",
  "updatedAt": "string"
}
```

**返回码**:
- 60010: 创建成功
- 60011: 参数错误
- 60012: 创建失败

---

### 更新评论

**接口地址**: `PUT /comments/:commentId`

**路径参数**:
- `commentId`: 评论 ID (必填)

**请求参数**:
```json
{
  "content": "string (可选)",
  "attachments": ["string"] (可选),
  "isTopUp": "bool (可选)"
}
```

**响应数据**:
```json
"评论 ID"
```

**返回码**:
- 60020: 更新成功
- 60021: 参数错误
- 60022: 请求参数错误
- 60023: 更新失败

---

### 删除评论

**接口地址**: `DELETE /comments/:commentId`

**路径参数**:
- `commentId`: 评论 ID (必填)

**响应数据**:
```json
"评论 ID"
```

**返回码**:
- 60030: 删除成功
- 60031: 参数错误
- 60032: 删除失败

## 其他接口

### 健康检查接口

**接口地址**: `GET /api/ping`

**响应数据**:
```json
{
  "message": "pong"
}
```

**返回码**:
- 200: 成功

## 错误码说明

| 错误码范围 | 业务模块 | 说明 |
|-----------|---------|------|
| 10000-19999 | 用户认证 | 包含登录、注册、检查登录、登出、用户信息管理等操作的错误码 |
| 20000-29999 | 项目管理 | 包含项目的创建、更新、删除、归档等操作的错误码 |
| 30000-39999 | 标签管理 | 包含标签的创建、更新、删除等操作的错误码 |
| 40000-49999 | 任务管理 | 包含任务的创建、更新、删除、恢复等操作的错误码 |
| 50000-59999 | 事件管理 | 包含事件的创建、更新、删除、排序等操作的错误码 |
| 60000-69999 | 评论管理 | 包含评论的创建、更新、删除等操作的错误码 |

**错误码格式说明**: 
- XXXXX: 完整错误码
- XXXX0: 成功操作
- XXXX1: 参数错误
- XXXX2: 业务错误/操作失败

## 权限说明

### 接口权限分类

| 权限级别 | 接口路径 | 说明 |
|---------|---------|------|
| 公共接口 | `/api/ping` | 无需认证即可访问 |
| 认证接口 | `/auth/signin`, `/auth/signup` | 需要用户认证信息但无需 JWT Token |
| 需要 JWT | `/auth/checkin`, `/auth/signout`, `/auth/validate` | 需要有效的 JWT Token |
| 用户接口 | `/user/*` | 需要用户已登录 |
| 项目接口 | `/projects/*` | 需要用户已登录且对项目有访问权限 |
| 标签接口 | `/tags/*` | 需要用户已登录 |
| 任务接口 | `/tasks/*` | 需要用户已登录且对任务有访问权限 |
| 事件接口 | `/events/*` | 需要用户已登录且对事件所属任务有访问权限 |
| 评论接口 | `/comments/*` | 需要用户已登录且对评论所属任务有访问权限 |

## 附录

### 数据类型说明

- `string`: 字符串类型
- `int`, `int8`, `int16`, `int32`, `int64`: 整数类型
- `uint`, `uint8`, `uint16`, `uint32`, `uint64`: 无符号整数类型
- `bool`: 布尔类型
- `time.Time`: 时间类型 (格式: RFC3339)
- `any`: 任意类型 (JSON 对象或数组)

### 请求方式

- `GET`: 获取资源
- `POST`: 创建资源
- `PUT`: 更新资源
- `DELETE`: 删除资源

### 响应头

- `Content-Type: application/json; charset=utf-8`
- `Access-Control-Allow-Origin`: 允许跨域请求的源
- `Access-Control-Allow-Credentials: true`

### 请求头

- `Authorization: Bearer <JWT Token>`: 用于 JWT 认证的请求头
- `Content-Type`: 请求内容类型 (application/json 或 multipart/form-data)

---

**注**: 本文档根据代码自动生成，如有遗漏或错误，以实际代码为准。
