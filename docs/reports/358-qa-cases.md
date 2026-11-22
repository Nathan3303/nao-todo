# T738/T741 · #358 桌面端应用内自我更新的用例集（AC ↔ 用例 ↔ 变异覆盖）

> 用途：一眼查「哪条 AC 由哪些已入库用例守着、有没有杀手级的变异（把实现改坏会不会红）」；⛔ 本文件不含 `/tmp` 临时探针，所列用例**全部在仓库内、无 skip/only**。
> 数字为 qa 自跑：`pnpm exec vp test --run` 上述 12 个文件 ⇒ **12 文件 / 181 例 / 0 红**（`apps/desktop/src/main/updater/__tests__` 8 文件 115 例；面板 41 + hook 12 + hint 6 + locale 7）。
> 记号：**●** = 有变异证据（改坏实现该 AC 会红）· **○** = 只有正向用例（未做变异）· M 编号沿用 `358-qa-report.md` §二（M16 / M17 为 T741 本轮新增）。

## AC1 展示当前版本 + 新版本 + 可点更新

- `apps/desktop/src/main/updater/__tests__/core.test.ts`：「AC1：远端更高 ⇒ available（版本 / 体积 / 模式齐备）」→ 状态与三字段齐备。**○**
- 同上：「检查中重复触发不收第二次请求（防连点）」→ 请求计数 1。**○**
- `apps/web/src/components/settings/panels/__tests__/t737-desktop-update-card.test.ts`：「R1 版本行永不被状态替换」「available：显示版本 + 体积提示 ⇒「立即更新」可点并调 `download()`」「体积未知 ⇒ 不写 MB」。**○**
- `apps/desktop/src/main/updater/__tests__/adapter-electron-updater.test.ts`：「成功 ⇒ 版本 + 当前平台产物体积（path 命中优先）」「体积缺失/为 0 ⇒ 不给数字」。**○**

## AC2 下载 → 用户点重启才安装（0 / 0 / 1）

- `core.test.ts`：「下载完成只进 ready，安装器调用数在点『立即重启更新』前恒为 0」（检查后 0、下载后 0）→ **●** M4（下载成功即装 ⇒ 3 红）。
- 同上：「ready 期重复点安装只调一次安装器（幂等）」→ 安装器计数恒 1。**●**（同上）
- `t737-desktop-update-card.test.ts`：「点『稍后』只改本地态（⛔ 不安装/不重启）」→ `restartToInstall` 调用 0 次 + `data-update-state` 仍 `ready` + 卡 A 不弹。**●** **M16（T741）**：把「稍后」`@click` 接上 `restartAndInstall()` ⇒ **1 红 / 40 绿**，还原 ⇒ 41/41 绿。
- 同上：「点『立即重启更新』⇒ 安装/重启通道恰 1 次（反向对照，防『恒不调』也绿）」→ **●**（同 M16 的反向对照维度）。
- `apps/desktop/src/renderer/src/hooks/__tests__/t737-use-desktop-updater.test.ts`：「检查 / 下载 / 重启安装各调桥一次，并采纳返回状态」。**○**

## AC3 Win/AppImage 原地生效（⚠️ 仅判定级，无真机自动化）

- `install-mode.test.ts`（7 例判定表）：「Windows 安装版（已打包）⇒ 原地更新」「Linux AppImage（已打包 + APPIMAGE 非空）⇒ 原地更新」「AppImage 为空串 ⇒ 按 deb 处理（不靠猜测）」「win32 开发态 ⇒ 下载页」。**○**
- `adapter-electron-updater.test.ts`：「install ⇒ `quitAndInstall(false, true)` 恰好 1 次」「env 端口：版本/打包态取注入 app，平台取 `process.platform`，APPIMAGE 取注入 env」。**○**
- 残留：**替换后是否真的生效**只能真机/发布后首个真实升级验证（见报告 §五.1）。

## AC4 失败可读原因 + 重试 + 下载页

- `core.test.ts`：「检查失败 ⇒ failed(check) + 请求计数 1，且从未出现『已是最新』」+ ENOTFOUND / HTTP 500 / ETIMEDOUT 三分类 + 「失败后再次手动检查仍可触发」。**●** M11（检查失败吞掉 ⇒ 5 红）。
- 同上：「失败原因收窄表（分类可测、不外泄内部错误）」。**○**
- `adapter-electron-updater.test.ts`「下载失败 ⇒ 阶段 + 原因码」**9 例**：ENOTFOUND / ERR_INTERNET_DISCONNECTED ⇒ offline；ETIMEDOUT / `net::ERR_TIMED_OUT` ⇒ timeout；503 / 404 ⇒ server；ENOSPC ⇒ disk；认不出 ⇒ unknown；非 Error ⇒ 不抛给调用方。**●** **M17（T741）**：去掉 `reason` ⇒ **11 红 / 17 绿（28）**，还原 ⇒ 28/28 绿。
- `t737-desktop-update-card.test.ts`：「failed（检查）⇒ 可读原因 + 重试 + 打开下载页，且不得出现『已是最新』」「failed（校验未过）⇒ 单列文案，不写内部术语」。**○**

## AC5 中断 / 哈希失败不进 ready

- `core.test.ts`：「下载中断/校验失败 ⇒ failed(verify) 且不进入 ready（可重试）」「下载中断（连接断）⇒ failed(download)/offline，不进 ready、安装器 0、可重试」「下载器抛错 ⇒ failed(download) + 收窄后的原因」。**●** M5（校验失败也进 ready ⇒ 1 红）。
- `adapter-electron-updater.test.ts`：「校验未过 ⇒ `stage=verify`（不得进待重启）」「下载中断（reject）⇒ 失败可重试，且进度监听已解绑」。**○**
- `t737-desktop-update-card.test.ts`：「failed（下载 / 校验）⇒ 重试走重新下载」。**○**

## AC6 版本相等 ⇒ 已是最新

- `version.test.ts`（7 例）：「数字按数值比较而非字典序（1.10.0 > 1.9.0）」「末段多一位不被字典序骗过（1.20.30 > 1.20.3）」「容忍 v / V 前缀」「无法解析 ⇒ null / false」。**●** M2（`>` → `>=` ⇒ 2 红）。
- `core.test.ts`：「远端等于当前版本 ⇒ up-to-date」「远端更旧 ⇒ 仍是 up-to-date（回滚重发不误报）」。**●**（M2）
- `t737-desktop-update-card.test.ts`：「AC6：已是最新 ⇒ 无任何主按钮」。**●**（M2）

## AC7 macOS / deb 降级到下载页

- `install-mode.test.ts`：「macOS（ad-hoc 未签名）⇒ 下载页 + mac 原因」「Linux deb ⇒ 下载页 + deb 原因」「未知平台 ⇒ 不给原因（不编造）」。**●** M6（mac 误判 in-place ⇒ 2 红）。
- `core.test.ts`：「macOS ⇒ available + download-page + mac 原因，且不触发下载（下载计数 0）」「deb 同理」。**●**（M6）
- `t737-desktop-update-card.test.ts`：「AC7：降级 ⇒ 动作替换为『打开下载页』+ 一行原因，无『立即更新』」。**●**（M6）

## AC8 24h 缓存（含边界值）

- `store.test.ts`：「23:59:59.999 ⇒ 新鲜（静默检查 0 请求）」「24:00:00.000 ⇒ 过期（1 请求）」「无记录 ⇒ 不新鲜（首启必查一次）」→ 边界值成对。**●** M3（`<` → `<=` ⇒ 2 红）。
- `core.test.ts`：「静默检查按 23:59:59.999 / 24:00:00.000 计请求数」「手动检查忽略缓存（必发一次）」「重启后仍显示上次结果（不回到 idle，且不再请求）」。**●** M3 + M12（手动检查也走缓存 ⇒ 1 红）。
- `wiring.test.ts`：「`start()` 排一次静默检查，延后 ≥10s（更小值被抬到 10s）」「`start()` 幂等」「定时器本身抛错 ⇒ 不抛，只报 onError」。**○**

## AC9 数据护栏（未同步队列非空先确认）

- `t737-desktop-update-card.test.ts` 卡 A 5 例：「队列非空 ⇒ 先出护栏且不立即安装」「『仍要更新』⇒ 二次确认后才装」「『取消』⇒ 不重启、仍为 ready」「『先同步再更新』⇒ 触发手动同步、不重启」「⛔ 判据不是 `failedCount`：队列空 + failedCount>0 ⇒ 不弹护栏直接装」。**●** M1（判据换 failedCount ⇒ 5 红）/ M13（忽略 force ⇒ 1 红）/ M15（立即更新绕过护栏 ⇒ 4 红）。
- `core.test.ts`：「有未同步改动时不安装（安装器 0），已下载状态保留；确认后才装」。**●**（M13 / M15）
- `t737-use-desktop-updater.test.ts`：「卡 A『仍要更新』⇒ 安装载荷带 `force:true`」。**●**（M13）

## AC10 Web 端零外溢

- `t737-desktop-update-card.test.ts`「AC10」3 例：「Web：无更新卡、无状态行、无卡 A（节点数 0）」「版本行仍是『版本号 + 查看更新』外链」「即使 hook 状态是 available 也不渲染」。**●** M8（去掉 `v-if="isDesktopUpdater"` ⇒ 2 红）。
- `t737-update-hint-ring.test.ts`（6 例）：「`hintVisible=false` ⇒ 无环、齿轮可访问名为『设置』」「rail / drawer 两形态各验有环/无环」「6px 空心环样式契约（源级）」。**○**

## AC11 失败后可再触发

- `state.test.ts`：「failed 之后仍可再检查 / 再下载（不永久禁用）」「非法迁移被拒绝且不通知订阅者」「订阅者可取消」。**●** M7（failed 态禁检查 ⇒ 1 红）。
- `t737-desktop-update-card.test.ts`：「AC11：失败态关闭提示后仍可再检查（按钮不永久禁用）」。**●**（M7）

## AC12 三态可辨（三重冗余）

- `t737-desktop-update-card.test.ts` 八态表驱动 8 例：「idle…failed 各态：`data-update-state` + 符号 + 文字 + 语义色类」。**●** M9（`available` 语义色改 muted ⇒ 1 红）。
- 同上：「状态行 live 区只挂阶段文案；`progressbar` 单独承载进度」「首帧未 loaded ⇒ 不挂 `role=status`」。**○**
- 对比度（4.95 / 6.67 / 8.97 文本，3.78 / 5.31 / 7.35 图形）：qa 自算 WCAG 值，属**静态核算不具备用例形态**（`DESIGN.md` 为权威口径）。

## AC13 i18n（40 键双语言 + 说人话）

- `packages/shared/locales/__tests__/t737-desktop-update-locale-keys.test.ts`（7 例）：「zh-CN / en-US 键齐备且非空」「插值占位符双语气一致」「八态文字互不相同」「不裸露内部术语（updater / sha512 / AppImage / 内部编号）」「数据护栏文案为软提示（不出现『失败』）」「体积未知文案不编数字」。**●** M10（zh-CN 删 1 键 ⇒ 1 红）。

## 判据缺口（T741 收尾时仍无变异证据的 AC）

- **AC1 / AC3 / AC12（对比度部分）** 只有正向用例或静态核算，**未做变异** ⇒ 其「红不红」未经证伪；AC3 更依赖真机（报告 §五.1）。
- 观察：AC1 的 `available` 展示断言与 AC6 的 `>` 判据共用同一条链路，M2 已间接证明「误报有更新」会红 —— 故 AC1 的缺口属**展示层细节**，不构成功能风险。