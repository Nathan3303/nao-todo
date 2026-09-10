# SHELL-02 人工冒烟单（桌面端）

> 用途：`scripts/electron-smoke/run.mjs` 覆盖不到的人工环节（观感、极端环境），或需要人手复验时的对照单。
> 括号内为 QA 在 Electron 43.4.1 / Chromium 150 / 后端 localhost:3302 上实测的基线数值。
> 自动化版本见 `../../README.md`：`NAO_QA_EMAIL=... NAO_QA_PASSWORD=... node scripts/electron-smoke/run.mjs --launch`。

## 0. 环境与启动（关键，先做）

```bash
# 后端需存活：http://localhost:3302/api/ping → {"code":200}
pnpm --filter @nao-todo/desktopapp dev --noSandbox --remoteDebuggingPort 9333
```

- `--noSandbox`：本机 SUID sandbox helper 权限限制，必须加（否则 `FATAL ... chrome-sandbox` 直接退出）。
- 测试账号：**凭据不入库** —— 用环境变量 `NAO_QA_EMAIL` / `NAO_QA_PASSWORD` 传入（本机 dev 库自建账号即可，勿把任何口令写入仓库）；桌面端首次进入需在解锁页输入**同一密码**。
- **窗口必须真实可见**：若窗口被完全遮挡/最小化，Chromium 判定 `document.visibilityState === 'hidden'`，
  CSS 关闭动画不推进 → `animationend` 不触发 → 对话框/面板"关不掉"。这是环境陷阱，**不是缺陷**。
  自测前请把 Electron 窗口置于前台。
- 证据建议：DevTools Console 粘贴 `document.visibilityState` 应为 `visible`；几何断言用 `getBoundingClientRect`。

## 1. 齿轮可点（AC-01 / AC-07 / AC-11）

1. 侧栏展开（300px）与收起（70px）两态各测一次（左上角菜单按钮切换）。
2. 鼠标点击轨道最底部齿轮 → 设置对话框打开。
3. Console 断言：

```js
const g = document.getElementById('AppAsideSettingsGearBtn').getBoundingClientRect()
const b = document.querySelector('.sync-rail-btn').getBoundingClientRect()
const inter =
    Math.max(0, Math.min(g.right, b.right) - Math.max(g.left, b.left)) *
    Math.max(0, Math.min(g.bottom, b.bottom) - Math.max(g.top, b.top))
;[
    inter,
    g,
    b,
    document
        .elementFromPoint(g.x + g.width / 2, g.y + g.height / 2)
        .closest('#AppAsideSettingsGearBtn')
]
```

- 预期：`inter === 0`；齿轮中心 `elementFromPoint(...).closest('.sync-rail-btn') === null`。
- QA 实测基线：展开/收起两态均为 —— 同步按钮 `x=22,y=641,26×26`、齿轮 `x=23,y=675,24×24`、交集 0；
  按钮底 667 ≤ 齿轮顶 675（gap 8px，按钮恒在齿轮上方、齿轮最底）。
- 图标字形同尺寸：两者 `<i>` 均 24×24、左缘同为 `x=23`、常态色同为 `rgb(153,153,153)`。
- **已知观察项（P3，需 PM 裁量）**：外层按钮盒子 26×26（NueButton 自带 1px transparent border）vs 齿轮 24×24。
  字形视觉一致，若要求"像素级同尺寸"则是 1px×2 的差异。

## 2. 面板不位移（AC-02）

1. 鼠标悬停同步按钮 → 应出现 tooltip「同步」，位于按钮**上方**（top-center）。
    - QA 基线：tooltip 文案「同步」，tip 底 633 ≤ 按钮顶 641，水平中心偏移 0px。
2. 点击同步按钮 → 面板向**右**展开（right-center，dx=8px）；面板 min-width 192px / max-width 288px。
3. 全程无 layout shift：

```js
// 打开前记录，打开后再记录，两者应完全一致
const snap = () => {
    const b = document.querySelector('.sync-rail-btn').getBoundingClientRect()
    const g = document.getElementById('AppAsideSettingsGearBtn').getBoundingClientRect()
    const a = document.querySelector('.nue-aside--app-aside-v2').getBoundingClientRect()
    const r = document.querySelector('.nue-div--mainly-aside').getBoundingClientRect()
    return {
        b: [b.x, b.y, b.width, b.height],
        g: [g.x, g.y, g.width, g.height],
        asideW: a.width,
        railW: r.width
    }
}
```

- QA 基线：打开前后按钮/齿轮 rect 完全一致；aside 300→300、rail 70→70。
- 面板内容：首行「上次同步 HH:mm」（无记录时「从未同步」）、footer `theme="primary"` 按钮「立即同步」。
- 关闭动画残余窗口 ≤240ms 内点齿轮/其它轨道元素，**第一下只关面板** = 库内既有 dropdown 语义，**不报缺陷**。

## 3. 堆叠 / 模态（AC-09）——唯一"代码静态看不出来"的验证点

1. 先打开同步面板（保持开启）。
2. 按 `⌘,`（Windows/Linux 为 `Ctrl+,`，命令 `app.settings.open`）打开设置对话框。
    - 预期 A：面板**已自动收起**（`.nue-dropdown-wrapper[data-visible]` 变 `false`，「立即同步」按钮从 DOM 移除）。
    - 预期 B：对话框**不被透明 overlay 吞点击** —— 用 `elementFromPoint` 取对话框 header/中部/底部三点，
      三点都必须命中对话框内部元素。
    - QA 基线：面板 `data-visible=false`；footer 按钮消失；3 点 `(540,72)/(540,382)/(232,691)` 均 `dlg.contains(hit) === true`。
3. 对话框开启期间按 `n` / `p`：不应弹出任务/项目创建器（QA 基线：dialog 数 1→1）。
4. `Esc` 关闭对话框：焦点应回到齿轮（QA 实测 3/3 归还）。
5. **残余窗口（≤240ms）**：面板关闭动画未结束时点齿轮，第一下只关面板 = 既有语义，不报缺陷。

## 4. 回归（AC-13 / AC-14 / AC-08 / AC-10）

1. web 端（浏览器）侧栏视觉/交互与改动前一致；注入点空节点为 `display:contents`，不占位、不贡献 flex gap。
2. 设置对话框关闭后焦点回齿轮；对话框开启期间 n/p 抑制（见第 3 步）。
3. 宿主缺失分支（AC-08/AC-10）：把窗口宽度拖到 ≤445px（或 DevTools 设备模拟 420px）
    - 预期：轨道按钮与注入点**整体不存在**、无旧版左下悬浮同步层、**无 console warn/error**、无重复挂载；
      恢复宽度后恰好挂载 1 份。
    - QA 基线：420px 下 `railBtn/slot/floating = 0/0/false`，console 0 条 warn/error；恢复后 1/1。
4. 键鼠可达链（AC-03）：轨道按钮 `Enter` 开面板 → `Tab` 应落到 footer「立即同步」→ `Enter` 触发 → `Esc` 关并归还焦点。

## 5. 已知问题（自测时可直接复现，不属 SHELL-02 引入）

- **DEF-01（P2/一般，pre-existing）**：断网后点「立即同步」，控制台有 `[sync] 拉取归一化错误（断网/超时）`，
  但面板**不会**显示失败错误摘要、轨道按钮**不会**变失败色。
  根因：`manualSync()` = `pullAll()` → `pushAll()`，而 `pushAllInner()` 开头 `syncStatus.markSyncing()` 会
  `lastError: null`，随后空队列 `refreshCounts()` 以 `lastError=null` 收尾 → 拉取阶段的错误被推送阶段清空。
  （`sync-status.ts:51-53` / `sync-service.ts:507-511,629-632`）
  后果：AC-04 的"失败错误摘要"与失败着色在本路径下不可达；`InitialSyncGate` 同样用 `lastError` 判成败，存在同类误判风险。

## 6. 前置小坑（自测时避免误报）

- 同步进行中轨道按钮 `loading + disabled`（图标变 `icon-loading` + spin）= **预期**，非缺陷。
- 极度窄窗下库内可能将面板 flip 到左侧/上侧 = 声明偏好非像素判据，非缺陷。
- 面板 footer 用 `<li><nue-button/></li>` 而非 `<nue-dropdown-item>` = ADR §5 **有据偏离**（item 无 tabindex/role/keydown，键盘不可达），非缺陷。