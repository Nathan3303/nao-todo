# @nao-todo/presentation-identity

身份领域表现层（Vue 3），提供认证相关组件、hooks 与全局 Store。

## 📁 目录结构

```text
packages/presentation-identity/
└── src/
    ├── components/      # 认证与用户设置组件
    ├── hooks/           # 组合式函数（use-auth-store-base）
    ├── stores/          # 全局 Store（user / theme / locale）
    └── index.ts         # 包入口
```

## 📦 模块说明

### `stores/` — 全局 Store

- `user-store.ts` — 用户认证状态（JWT、登录态、用户信息）
- `theme-store.ts` — 主题状态（明暗主题切换）
- `locale-store.ts` — 语言状态（多语言切换）

### `hooks/`

- `use-auth-store-base.ts` — 认证 Store 基类 hook，装配 `@nao-todo/domain-identity` 的用例

### `components/` — 认证与用户设置组件

- **认证流程**：`sign-in.vue`（登录）、`sign-up.vue`（注册）、`check-in.vue`（检入，已持 JWT 快捷登录）
- **个人信息**：`avatar-updater`（头像修改）、`nickname-updater`（昵称修改）、`info-viewer`（信息展示）
- **账户安全**：`password-updater`（修改密码）、`deactive-manager`（注销管理）、`deletion-notifier`（注销反悔期提醒）
- **应用设置**：`theme-setter`（主题切换）、`language-setter`（语言切换）
- **对话框（dialogs/）**：`avatar-cropper`（头像裁剪）、`avatar-viewer`（头像查看）、`deactive-user`（注销确认）、`restore-user`（恢复账号）

## 🔗 依赖

- `@nao-todo/domain-identity`（workspace，装配用例）
- `@nao-todo/shared`（workspace）
- Vue 3 / Pinia（由消费方提供）