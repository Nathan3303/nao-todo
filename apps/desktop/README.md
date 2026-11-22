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
│           ├── AppRoot.vue   # 启动门（本地就绪判定 + 待升级/迁移入口）→ 渲染主应用
│           ├── hooks/
│           │   ├── index.ts  # 装配层：UI hooks 复用 webapp，usecases 走桌面实现
│           │   └── usecases/ # 10 个装配工厂：认证远程、业务本地
│           └── components/
│               └── unlock-gate.vue  # 启动门（待升级/迁移入口 + 登出；密码仅用于迁移窗口）
└── out/                      # 构建产物（main / preload / renderer）
```

**UI 复用方式**：`@nao-todo/webapp` 即共享包。渲染层构建时通过 alias 把 `@` 指向 `apps/web/src`（views/components/themes/router/commands 全部复用），`@/hooks` 重定向到桌面自有装配层。webapp 源码零复制，提醒等应用能力由共享壳统一提供，桌面端不再单独接线。

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

## 走查「关于与更新」的九种状态（仅开发态）

打包版永远走真实更新源。下面这套**只在 `pnpm desktop:dev`（未打包）且设了环境变量时生效**，用途是把「关于与更新」的九种状态都点一遍：全程不联网、不真下载、不真重启。

1. **准备一份配置**：新建 `/tmp/fake-feed.json`，写下面的内容（`version` 比当前版本大 ⇒ 有新版本；写成当前版本 ⇒ 已是最新）。

```text
{
    "version": "9.9.9",
    "sizeBytes": 157286400,
    "download": { "steps": 8, "intervalMs": 400 }
}
```

2. **起假源**：`NAO_UPDATE_FAKE_FEED=/tmp/fake-feed.json pnpm desktop:dev`（路径建议用绝对路径），打开「设置 → 关于与更新」，点「检查更新」⇒ 显示「有新版本 v9.9.9」。
3. **看下载与待重启**：点「立即更新」⇒ 进度按 `steps` / `intervalMs` 走完（**想快想慢改这两个数**：慢就 `10` / `1200`，快就 `3` / `100`），末态是「已下载，重启后更新」。
4. **看四种失败**：在配置里加失败原因——检查阶段用 `"check": { "fail": "offline" }`（另可 `timeout` / `server`），下载阶段用 `"download": { "fail": "verify" }`（另可 `offline` / `timeout` / `server`），再点一次「检查更新」或「立即更新」。**改完文件不用重启**，下一次点击就按新配置走。
5. **看「已更新」与退出假源**：点「立即重启更新」⇒ 不会真的退出、也不会替换任何文件，面板直接变成「已更新到 v9.9.9」（这个版本号只在本次运行内有效）；要退出假源模式，**不设** `NAO_UPDATE_FAKE_FEED` 重启即可（回到「当前安装方式不支持应用内更新」）。

## 已知行为与限制

- 任务提醒为**本地轮询**（与 Web 共用 `packages/shared/reminder` 引擎：可见态每 10s + 到期精确定时）+ 系统通知；判定只读本机数据，离线照常提醒
- 修改密码/注销账号/头像上传请前往 Web 端（桌面版返回不支持）；若在 Web 端改过密码，需在桌面版用新密码登录解锁
- 通知图标在 `file://` 下回退默认图标（webapp `icon: '/favicon.ico'` 绝对路径不生效）
- 本地数据与 Web 端互不迁移（两套独立存储）