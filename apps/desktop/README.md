# NaoTodo 桌面端

基于 Electron 的 NaoTodo 桌面版：**业务数据完全本地化（IndexedDB + AES-GCM 加密）**，认证沿用远程后端。

## 架构

```
apps/desktop/
├── electron.vite.config.ts   # main / preload / renderer 三端构建配置
├── electron-builder.yml      # 打包配置（NSIS 安装包）
├── src/
│   ├── main/index.ts         # 主进程（窗口、AUMID、dev/prod 加载分流）
│   ├── preload/index.ts      # contextBridge 暴露最小 desktopAPI
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.ts       # 渲染进程入口（挂载 AppRoot）
│           ├── AppRoot.vue   # 本地数据解锁门 → 渲染主应用
│           ├── hooks/
│           │   ├── index.ts  # 装配层：UI hooks 复用 webapp，usecases 走桌面实现
│           │   └── usecases/ # 10 个装配工厂：认证远程、业务本地
│           └── components/
│               └── unlock-gate.vue  # 启动解锁页（输入密码解包 DEK）
└── out/                      # 构建产物（main / preload / renderer）
```

**UI 复用方式**：`@nao-todo/webapp` 即共享包。渲染层构建时通过 alias 把 `@` 指向 `apps/web/src`（views/components/themes/router/commands 全部复用），`@/hooks` 重定向到桌面自有装配层。webapp 源码零复制，仅一处 2 行小改（SSE 提醒加 `VITE_DISABLE_SSE` 开关）。

## 数据与加密

- **认证**：沿用远程后端（`VITE_API_BASE_URL`），JWT 流程不变
- **业务数据**：`@nao-todo/infrastructure` 新增 `persistence-local`（dexie），project/tag/task/pomodoro/记录/偏好全部存 IndexedDB
- **加密**：双层密钥体系（Bitwarden 同款）——密码经 PBKDF2-SHA256（60 万次迭代）派生 KEK，KEK 解开随机 DEK；业务数据用 DEK 做 AES-GCM 加密。DEK 只在内存，登出/退出即清空
- **索引**：结构字段（id/时间/状态/外键/排序）明文保索引，内容字段（name/description/note 等）加密
- **解锁**：首次登录自动创建密钥包；之后每次启动需输入密码解锁（记住登录时走 checkin + 本地解锁）

## 命令

```bash
pnpm desktop:dev      # 开发（electron-vite dev，HMR）
pnpm desktop:build    # 构建三端产物到 out/
pnpm desktop:dist     # 构建 + electron-builder 出 NSIS 安装包
pnpm desktopapp dist:dir  # 构建 + 仅出 unpacked 目录（免安装运行）
```

## 已知行为与限制

- 任务提醒为**本地定时扫描**（每 30s 查本地 `remindAt`）+ 系统通知；远程 SSE 提醒已禁用（`VITE_DISABLE_SSE=true`）
- 修改密码/注销账号/头像上传请前往 Web 端（桌面版返回不支持）；若在 Web 端改过密码，需在桌面版用新密码登录解锁
- 通知图标在 `file://` 下回退默认图标（webapp `icon: '/favicon.ico'` 绝对路径不生效）
- 本地数据与 Web 端互不迁移（两套独立存储）