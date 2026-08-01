# 头像修改功能实现计划

## 功能概述

实现用户头像修改功能，包括文件选择、图像裁剪和上传，并更新页面显示新头像。

## 后端API信息

根据 docs/backend-api.md 文档：

- 接口：`PUT /user/avatar`
- 支持两种请求格式：
    1. JSON (application/json)：通过 URL 更新
    2. 表单 (multipart/form-data)：通过文件上传更新
- 响应：返回 `{ "avatarURL": "string" }`
- 成功码：10080

## 当前状态分析

1. `avatar.vue` 组件已存在，包含文件选择功能
2. 已有 `updateAvatarURL` 方法（支持URL更新）
3. 缺少文件上传支持和图像裁剪功能
4. 缺少 NueDialog 对话框

## 实现步骤

### 1. 添加图像裁剪库依赖

- 研究并选择适合的 Vue 图像裁剪库
- 更新 package.json 添加裁剪库依赖
- 安装依赖

### 2. 扩展后端仓库支持文件上传

- 在 `packages/infrastructure/backend/user/repoImpl.ts` 中添加 `updateAvatarFile` 方法
- 实现 multipart/form-data 格式的文件上传
- 更新 `UserRepository` 接口

### 3. 扩展领域服务

- 在 `packages/domain/user/service.ts` 中添加头像文件更新方法
- 更新领域接口

### 4. 扩展应用层用例

- 在 `packages/application/web/usecases/user.ts` 中添加头像更新用例
- 更新用户存储以支持头像更新

### 5. 创建头像裁剪对话框组件

- 在 `apps/web/src/components/settings/profile/` 下创建 `avatar-cropper-dialog.vue`
- 集成图像裁剪库
- 使用 NueDialog 作为对话框容器
- 实现裁剪、上传功能

### 6. 修改 avatar.vue 组件

- 集成新的头像裁剪对话框
- 文件选择后打开对话框
- 上传成功后更新头像显示
- 更新用户 store

### 7. 测试和验证

- 测试文件选择
- 测试图像裁剪
- 测试文件上传
- 测试头像更新显示

## 技术要点

- 使用 FormData 处理文件上传
- 确保 JWT Token 正确传递
- 裁剪后转换为 Blob/File 对象上传
- 上传成功后更新 Pinia store 中的用户信息
- 错误处理和用户反馈

## 文件清单

- 新增：`apps/web/src/components/settings/profile/avatar-cropper-dialog.vue`
- 修改：`packages/infrastructure/backend/user/repoImpl.ts`
- 修改：`packages/domain/user/repositories.ts`
- 修改：`packages/domain/user/service.ts`
- 修改：`packages/application/web/usecases/user.ts`
- 修改：`packages/application/web/stores/user-store.ts`
- 修改：`apps/web/src/components/settings/profile/avatar.vue`