# Electron 冒烟工具（可复用）

面向 **桌面端（Electron）实机**的可重复冒烟工具：CDP 驱动真实渲染进程，做真实鼠标命中、真实按键、
几何断言（`getBoundingClientRect`）、截图与 console 采集。**零第三方依赖**，只用 Node 内置能力。

> 与 `vp test` 的分工：`vp test`（Vitest + jsdom）覆盖组件逻辑与断言口径；本工具覆盖
> **jsdom 覆盖不到的东西**——真实布局/动画/弹层池堆叠/焦点链/真实命中测试。

## 前置条件

| 项       | 要求                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| Node     | ≥ 22（依赖全局 `WebSocket` / `fetch`）                                                                               |
| 后端     | `localhost:3302` 存活（`curl localhost:3302/api/ping` → `{"code":200}`）。**后端未起会冷启动白屏（既有缺陷，见下）** |
| 账号     | 桌面端登录/解锁密码，通过环境变量注入（**不要写进仓库**）                                                            |
| 图形会话 | 需要真实显示；窗口必须能置前台（见「环境陷阱」）                                                                     |

```bash
export NAO_QA_EMAIL='<本地 dev 测试账号>'
export NAO_QA_PASSWORD='<该账号密码>'
```

## 快速开始

```bash
# 一条命令：自动起 Electron（含 --noSandbox + CDP 端口），跑完自动关
node scripts/electron-smoke/run.mjs --launch

# 已有实例在跑（比如手动 pnpm desktopapp dev --noSandbox --remoteDebuggingPort 9333）
node scripts/electron-smoke/run.mjs

# 只看有哪些分组 / 改动后只复跑受影响项
node scripts/electron-smoke/run.mjs --list
node scripts/electron-smoke/run.mjs --only smoke-2,d5b
```

`--launch` 内部执行：`pnpm --filter @nao-todo/desktopapp dev --noSandbox --remoteDebuggingPort 9333`。
`--noSandbox` 是本机必需项：pnpm 解包的 `chrome-sandbox` 属主非 root（0755），Electron 直接 `FATAL` 退出。

## 参数

| 参数                 | 说明                                                          |
| -------------------- | ------------------------------------------------------------- |
| `--launch`           | 自动启动 Electron 并在结束后关闭                              |
| `--feature <id>`     | 选择检查集（默认 `shell-02`）                                 |
| `--only <a,b>`       | 只跑指定分组（改动后复跑用）                                  |
| `--list`             | 列出分组                                                      |
| `--probe-task`       | 追加「受控探针任务」分组（**会写入 1 条业务数据**，默认关闭） |
| `--port <n>`         | CDP 端口（默认 9333）                                         |
| `--out <dir>`        | 证据目录（默认系统临时目录）                                  |
| `--email/--password` | 覆盖环境变量                                                  |
| `--title <t>`        | 探针任务标题（默认 `[QA-PROBE] 受控探针任务`）                |

## 产物

- `<out>/report.txt`、`<out>/report.json`：逐条 `[PASS|FAIL|INFO] 分组/id 标题 — 证据数值`
- 截图（仅在实现截图的分组）：`<out>/*.png`
- 退出码：有 `FAIL` 返回 1，否则 0（可直接接 CI / 脚本门禁）

## 环境陷阱（会造出**假失败**，务必先读）

1. **窗口必须在前台**。被其它窗口完全遮挡/最小化时 Chromium 判定 `document.visibilityState === 'hidden'`，
   **CSS 关闭动画不推进 → `animationend` 不触发 → 面板/对话框"关不掉"**。
   工具已在连接后 `Page.bringToFront` 并断言 `visible`，不满足直接报 `ENV-FAIL` 而非静默通过。
2. **面板/对话框关闭依赖动画结束事件**：断言必须在关闭动作后留足时间（本工具统一 1.0–1.3s）。
3. **同步执行期间轨道按钮 `disabled`+loading 图标是预期行为**，不是缺陷。
4. **后端未起时冷启动会白屏**（既有缺陷 `DEF-OFFLINE-01`）：根因是解锁页 `v-else-if="profile"` 依赖网络
   加载用户资料，失败被 catch 吞掉 → 两个分支都不渲染。工具用
   `Network.setBlockedURLs(['*localhost:3302*'])`（只封 API、保留 dev server）可稳定复现。

## 扩展新的检查集

1. 新建 `checks/<feature>.mjs`，导出结构：

```js
export const myFeature = {
    id: 'my-feature',
    title: '描述',
    groups: [
        {
            id: 'smoke-1',
            title: '分组标题',
            // optIn: 'probeTask',      // 需显式开关才跑（会写数据的分组）
            run: async ({ cdp, outDir }) => [
                { id: 'AC-1', title: '断言标题', status: 'PASS', detail: '实测数值' }
            ]
        }
    ]
}
```

2. 在 `run.mjs` 的 `FEATURES` 注册。
3. 复用 `lib/cdp.mjs`（连接/求值/鼠标/按键/截图/封锁网络/console）与 `lib/app.mjs`
   （引导登录解锁、`SEL` 选择器、打开面板、等同步空闲等）。

## 纪律

- 本工具**不修改任何功能代码**，只读页面 + 派发输入。
- 会写数据的分组（`--probe-task`）默认关闭；启用时请只用 QA 账号，并在跑完后确认
  「0 pending / 0 failed」（分组内已含删除与校验步骤）。
- 凭据仅经环境变量传入，勿提交到仓库。