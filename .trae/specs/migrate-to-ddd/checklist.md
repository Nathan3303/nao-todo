# NaoTodo Web - DDD 架构迁移验证检查清单

## 目录结构验证

- [ ] 存在 `src/domains/` 目录，包含 task、project、tag、pomodoro、user、settings、calendar 子目录
- [ ] 每个领域包含 `types/`、`store/`、`services/`、`components/` 子目录
- [ ] 存在 `src/shared/` 目录，包含 `composables/`、`utils/`、`types/`、`components/`
- [ ] 存在 `src/app/` 目录，包含 `router/`、`store/`
- [ ] 目录结构符合 frontend-ddd Level 3 标准

## 构建验证

- [ ] `pnpm build` 成功，无编译错误
- [ ] TypeScript 路径别名配置正确，无路径解析错误
- [ ] ESLint 检查通过，无错误

## 功能验证

- [ ] 开发服务器运行正常，所有路由可访问
- [ ] 用户认证功能正常（登录、注册）
- [ ] 任务管理功能正常（创建、编辑、删除、完成）
- [ ] 项目管理功能正常（创建、归档、删除）
- [ ] 标签管理功能正常
- [ ] 番茄钟功能正常（计时、记录）
- [ ] 设置页面功能正常
- [ ] 日历视图功能正常

## 架构验证

- [ ] 跨域依赖通过事件总线解耦，无直接跨域 import
- [ ] 业务逻辑集中在领域 Store 中
- [ ] 页面层为薄层，仅负责路由和布局
- [ ] 共享组件无业务依赖
- [ ] Store 命名符合约定（`useXxxStore`）

## 代码质量验证

- [ ] 导入路径使用 TypeScript 别名
- [ ] 领域内部使用相对路径导入
- [ ] 跨领域导入仅使用 `import type`
- [ ] 无遗留的旧路径引用
