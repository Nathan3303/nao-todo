# 环境变量配置方案

## 项目现状
- 使用 Vite 作为构建工具
- 目前在 `apps/web/src/main.ts` 中硬编码了 `baseURL: 'http://localhost:3302/api'`
- 使用 `@nao-todo/infrastructure/requester` 管理请求
- pnpm workspace 结构，包含 web/desktop/mobile 三个应用

## 方案设计

### 1. 环境变量文件结构
在 `apps/web/` 目录下创建：
- `.env` - 基础配置（所有环境共用）
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置
- `.env.example` - 配置示例（提交到 git）
- `.env.local` - 本地覆盖配置（不提交到 git）

### 2. 环境变量命名规则
使用 Vite 规范，以 `VITE_` 为前缀的变量会被注入到客户端代码中。

### 3. 配置内容
- API 基础地址
- 应用名称
- 其他后端相关配置

### 4. 代码改动
- 创建环境配置模块 `apps/web/src/infrastructure/config/env.ts`
- 修改 `main.ts` 使用环境变量
- 更新 `vite.config.ts`（如需额外配置）
- 更新 `.gitignore`

### 5. 构建脚本
保持现有脚本不变，Vite 会自动根据命令加载对应环境变量：
- `pnpm webapp dev` - 加载 `.env.development`
- `pnpm webapp build` - 加载 `.env.production`

## 实施步骤
1. 创建环境变量文件
2. 创建配置模块
3. 修改 main.ts 使用环境变量
4. 更新 .gitignore
5. 测试验证
