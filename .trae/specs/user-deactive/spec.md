# 用户注销功能 - 产品需求文档

## Overview

- **Summary**: 新增用户注销功能和取消注销功能。用户可以通过设置页面发起注销请求，注销流程包含确认弹窗、密码验证和协议同意步骤，注销后有7天冷却期。
- **Purpose**: 提供用户主动注销账号的能力和在冷却期内恢复账号的能力，确保用户数据安全和隐私保护。
- **Target Users**: NaoTodo 已登录用户

## Goals

- 实现完整的用户注销流程（确认 → 表单填写 → 提交）
- 注销请求包含用户密码参数，确保身份验证
- 提示用户注销后有7天冷却期
- 登录成功后检测用户待注销状态并跳转撤销注销页面
- 实现撤销注销流程（密码验证 → 协议同意 → 提交）

## Non-Goals (Out of Scope)

- 数据清理逻辑
- 管理员强制注销功能

## Background & Context

- 后端接口已就绪：
    - 注销用户：`DELETE /user/`，请求体 `{ password: string }`
    - 激活用户（取消注销）：`PUT /user/restore`，请求体 `{ password: string }`
- 登录成功响应包含 `pendingDeletion` 和 `deletionDeadline` 字段，分别表示用户是否处于待注销状态和数据删除执行时间
- 项目采用五层架构：Views → Presentation → Application → Domain → Infrastructure
- 使用 NueUI 组件库构建 UI 组件

## Functional Requirements

- **FR-1**: 用户在设置页面点击注销按钮时，弹出确认注销的确认框
- **FR-2**: 用户确认后，弹出注销对话框，包含密码输入、确认密码输入和同意协议复选框
- **FR-3**: 注销对话框需提示用户注销后有7天冷却期，期间可取消注销
- **FR-4**: 提交注销请求时，验证密码和确认密码一致且非空，验证协议已同意
- **FR-5**: 注销请求包含用户密码参数发送到 `DELETE /user/` 接口
- **FR-6**: 用户登录成功后，检测响应体中的 `pendingDeletion` 字段
- **FR-7**: 如果 `pendingDeletion` 为 `true`，跳转到撤销注销页面
- **FR-8**: 撤销注销页面显示"当前用户已执行注销操作，处于待注销状态"提示，以及数据删除截止时间
- **FR-9**: 撤销注销页面包含密码输入框和同意协议复选框
- **FR-10**: 提交撤销注销请求时，验证密码非空且协议已同意
- **FR-11**: 撤销注销请求包含用户密码参数发送到 `PUT /user/restore` 接口
- **FR-12**: 撤销注销成功后，清除认证数据并跳转到登录页面，用户需重新登录获取 JWT

## Non-Functional Requirements

- **NFR-1**: 注销流程需符合项目现有的错误处理模式
- **NFR-2**: UI 组件需遵循 NueUI 设计规范
- **NFR-3**: 代码需遵循 DDD 架构原则，依赖方向正确

## Constraints

- **Technical**: 必须遵循五层架构，Presentation 层不直接依赖 UseCase，使用回调机制
- **Dependencies**: 依赖 NueUI 组件库、Pinia 状态管理

## Assumptions

- 后端 `DELETE /user/` 接口已支持接收 `{ password: string }` 请求体
- 后端 `PUT /user/restore` 接口已支持接收 `{ password: string }` 请求体
- 后端登录成功响应包含 `pendingDeletion` 和 `deletionDeadline` 字段
- 后端已实现7天冷却期逻辑

## Acceptance Criteria

### AC-1: 注销确认弹窗

- **Given**: 用户在设置页面
- **When**: 用户点击注销按钮
- **Then**: 弹出确认注销的对话框，显示"确认注销用户吗？"标题和提示信息
- **Verification**: `human-judgment`

### AC-2: 注销表单对话框

- **Given**: 用户确认注销
- **When**: 用户点击确认按钮
- **Then**: 弹出注销表单对话框，包含密码输入框、确认密码输入框和同意协议复选框
- **Verification**: `human-judgment`

### AC-3: 冷却期提示

- **Given**: 用户看到注销表单对话框
- **When**: 用户查看对话框内容
- **Then**: 对话框中显示提示信息："执行注销后有7天的冷却期，7天之后才会真正删除数据，期间可以取消注销"
- **Verification**: `human-judgment`

### AC-4: 表单验证

- **Given**: 用户在注销表单对话框
- **When**: 用户点击提交按钮
- **Then**: 系统验证密码非空、确认密码与密码一致、协议已同意
- **Verification**: `programmatic`

### AC-5: 注销请求发送

- **Given**: 用户填写正确的注销表单
- **When**: 用户点击提交按钮
- **Then**: 系统发送包含密码参数的 DELETE 请求到 `/user/` 接口
- **Verification**: `programmatic`

### AC-6: 注销成功处理

- **Given**: 注销请求成功
- **When**: 后端返回成功响应
- **Then**: 系统清除用户认证数据，跳转到登录页面
- **Verification**: `programmatic`

### AC-7: 登录成功后检测待注销状态

- **Given**: 用户处于待注销状态（`pendingDeletion: true`）
- **When**: 用户登录成功
- **Then**: 系统检测到响应体中的 `pendingDeletion` 为 `true`，跳转到撤销注销页面
- **Verification**: `programmatic`

### AC-8: 撤销注销页面显示

- **Given**: 用户跳转到撤销注销页面
- **When**: 页面加载完成
- **Then**: 页面显示"当前用户已执行注销操作，处于待注销状态"提示，以及数据删除截止时间
- **Verification**: `human-judgment`

### AC-9: 撤销注销表单

- **Given**: 用户在撤销注销页面
- **When**: 用户查看页面内容
- **Then**: 页面包含密码输入框和同意协议复选框
- **Verification**: `human-judgment`

### AC-10: 撤销注销表单验证

- **Given**: 用户在撤销注销页面
- **When**: 用户点击提交按钮
- **Then**: 系统验证密码非空、协议已同意
- **Verification**: `programmatic`

### AC-11: 撤销注销请求发送

- **Given**: 用户填写正确的撤销注销表单
- **When**: 用户点击提交按钮
- **Then**: 系统发送包含密码参数的 PUT 请求到 `/user/restore` 接口
- **Verification**: `programmatic`

### AC-12: 撤销注销成功处理

- **Given**: 撤销注销请求成功
- **When**: 后端返回成功响应
- **Then**: 系统清除用户认证数据，跳转到登录页面，用户需重新登录获取 JWT
- **Verification**: `programmatic`

## Open Questions

- [x] 后端 `DELETE /user/` 接口的请求体格式已确定：`{ password: string }`
- [x] 后端 `PUT /user/restore` 接口的请求体格式已确定：`{ password: string }`
- [x] 登录成功响应包含 `pendingDeletion` 和 `deletionDeadline` 字段