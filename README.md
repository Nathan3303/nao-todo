# NaoTodo

## 🚀 项目简介

NaoTodo 是一个待办任务管理平台，旨在为用户提供简洁高效的任务管理体验。该平台基于 Vue 3、Vite、TypeScript、NueUI、Pinia 构建，采用 pnpm monorepo 架构，支持 Web、移动端和桌面端。

## 🌐 站点地址

- [NaoTodo](https://todo.nathanap.space/)

## 👨‍💻 开发者信息

- **作者**：Nathan Lee
- **GitHub 仓库**：[NaoTodo GitHub 仓库](https://github.com/Nathan3303/nao-todo)

## 🛠️ 技术栈

- **前端框架**：Vue 3
- **构建工具**：Vite
- **UI 框架**：[NueUI](https://github.com/Nathan3303/nue-ui)
- **状态管理**：Pinia
- **国际化**：Vue I18n
- **HTTP 请求**：Axios
- **本地存储**：Dexie (IndexedDB)
- **编程语言**：TypeScript
- **包管理**：pnpm (monorepo)

## 📁 项目结构

```
nao-todo/
├── apps/
│   ├── web/          # Web 客户端
│   ├── mobile/       # 移动端客户端
│   └── desktop/      # 桌面端客户端
├── packages/
│   ├── application/  # 应用层逻辑
│   ├── components/   # 通用 UI 组件
│   ├── domain/       # 领域模型与业务逻辑
│   ├── infrastructure/ # 基础设施（API 封装等）
│   └── types/        # 共享类型定义
└── deploy/           # 部署相关配置
```

## 🎨 功能特性

1. **任务管理**：支持任务的创建、编辑、删除及查看详情。
2. **优先级设置**：可为任务设置高、中、低三种优先级。
3. **进度设置**：支持待办、正在进行、已完成等多种进度状态。
4. **截止日期**：为任务添加截止日期，提醒按时完成。
5. **检查事项**：为任务添加子步骤，进一步细分任务，快速了解进度。
6. **评论功能**：为任务添加评论，记录任务进展与想法。
7. **清单与标签**：创建清单和标签以分类和标记任务。
8. **多视图**：支持表格视图、列表视图、看板视图和日历视图。
9. **用户系统**：支持账号注册、登录及个人信息管理。
10. **多语言**：支持中文、英文等多语言切换。
11. **跨平台**：支持 Web、移动端和桌面端。

## 🚀 快速开始

### 环境要求

- Node.js >= 24
- pnpm >= 8

### 安装与运行

```bash
# 安装依赖
pnpm install

# 启动 Web 客户端
pnpm webapp dev

# 启动移动端客户端
pnpm mobile dev

# 启动桌面端客户端
pnpm desktop dev
```

### 构建

```bash
# 构建 Web 客户端
pnpm webapp build
```

## 📝 贡献指南

欢迎对 NaoTodo 做出贡献！在提交代码之前，请确保：

1. 提交 Pull Request 前，先确保所有测试通过。
2. 详细描述你的更改内容和目的。

## 📜 许可证

NaoTodo 项目遵循 [MIT 许可证](https://github.com/Nathan3303/nao-todo/blob/main/LICENSE)。你可以自由地使用、复制、修改和分发该项目，但请保留原作者和版权信息。

## 💡 鸣谢

感谢所有参与 NaoTodo 项目开发、测试、反馈的用户和贡献者！特别感谢 Vue、Vite、Pinia、NueUI、Axios 以及 TypeScript 的开发团队，为前端开发提供了强大的工具和框架。

