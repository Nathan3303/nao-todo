# 文案（zh-CN / en-US）· 桌面端自我更新 · T734 / Issue #358

> 配套设计稿：`docs/designs/358-desktop-self-update.md`。落点：`packages/shared/locales/{types,zh-CN,en-US}.ts` **三处齐备**（`LocaleKey` 联合类型 + 中英各一）。
> 命名：`settings.update.<语义>`；插值沿用既有风格 `{version}` / `{count}` / `{percent}`。
> **表格形式说明**：本文件按 `deliverable-docs.md §七` 例外 ③（机器可读 / 需被解析的结构化清单）保留表格 —— 内容即将逐行落入 `locales`，列固定为 key / zh-CN / en-US。
> 复用既有键：`common.cancel`（取消）；⛔ **不再复用 `common.retry`** —— 失败态无行内「重试」（AC4 · 2026-11-22 走查反馈），再试入口 = R1「检查更新」。⛔ 面向用户禁出现 `updater` / `autoUpdater` / `sha512` / 内部编号 / 本机路径 / 底层错误原文（AC9b）。

## 一、分组与版本行

| key                              | zh-CN              | en-US             |
| :------------------------------- | :----------------- | :---------------- |
| `settings.update.title`          | 关于与更新         | About & updates   |
| `settings.update.currentVersion` | 当前版本 {version} | Version {version} |

> ⛔ 本块**不使用副标题**：原 `settings.update.desc`（「当前版本与更新状态」）已移除 —— 与卡片内容同义重复，分组由卡片承担（设计稿 §3）。
> | `settings.update.lastChecked` | 上次检查：{time} | Last checked: {time} |
> | `settings.update.check` | 检查更新 | Check for updates |
> | `settings.update.checking` | 正在检查更新… | Checking for updates… |
> | `settings.update.checkBlockedByReady` | 重启应用后即可再次检查 | You can check again after restarting |

## 二、状态行（与设计稿 §5 一一对应）

| key                                   | zh-CN                          | en-US                                                      |
| :------------------------------------ | :----------------------------- | :--------------------------------------------------------- |
| `settings.update.idle`                | 还没检查过更新                 | Not checked yet                                            |
| `settings.update.idleHint`            | 点「检查更新」看看有没有新版本 | Use "Check for updates" to see if there is a newer version |
| `settings.update.available`           | 有新版本 {version}             | Version {version} is available                             |
| `settings.update.availableHint`       | 下载约 {size}，装好后重启生效  | About {size} to download. It takes effect after a restart  |
| `settings.update.availableHintNoSize` | 装好后重启生效                 | Takes effect after a restart                               |
| `settings.update.updateNow`           | 立即更新                       | Update now                                                 |
| `settings.update.downloading`         | 正在下载更新…                  | Downloading update…                                        |
| `settings.update.downloadingSize`     | 已下载 {done} / {total}        | {done} of {total} downloaded                               |
| `settings.update.downloadingPercent`  | 已下载 {percent}%              | {percent}% downloaded                                      |
| `settings.update.ready`               | 更新已就绪                     | Update ready                                               |
| `settings.update.readyHint`           | 重启应用后生效                 | Restart the app to finish                                  |
| `settings.update.restartNow`          | 立即重启更新                   | Restart and update                                         |
| `settings.update.later`               | 稍后                           | Later                                                      |
| `settings.update.upToDate`            | 已是最新 {version}             | You're on the latest version ({version})                   |
| `settings.update.justUpdated`         | 已更新到 {version}             | Updated to {version}                                       |
| `settings.update.justUpdatedHint`     | 这是本次启动装好的新版本       | Installed during this launch                               |
| `settings.update.openDownloadPage`    | 打开下载页                     | Open download page                                         |

## 三、失败态（原因；动作只有「打开下载页」）

| key                              | zh-CN                        | en-US                                                      |
| :------------------------------- | :--------------------------- | :--------------------------------------------------------- |
| `settings.update.failedCheck`    | 没能检查更新                 | Couldn't check for updates                                 |
| `settings.update.failedDownload` | 下载没完成                   | The download didn't finish                                 |
| `settings.update.failedVerify`   | 更新包校验没通过，已停止安装 | The download didn't pass its check, so it wasn't installed |
| `settings.update.reason.offline` | 当前没有网络连接             | You're offline                                             |
| `settings.update.reason.timeout` | 服务器没有响应               | The server didn't respond                                  |
| `settings.update.reason.server`  | 更新服务暂时不可用           | The update service is temporarily unavailable              |
| `settings.update.reason.disk`    | 磁盘空间不足                 | Not enough disk space                                      |
| `settings.update.reason.unknown` | 更新没能完成                 | Something went wrong                                       |

> **v3（2026-11-22 走查反馈 · AC4）**：`failed` 态**不提供行内「重试」**，动作只有 `settings.update.openDownloadPage`（primary，RD 侧调 `theme`）；再试 = 回 R1 点「检查更新」（永久可点）。⇒ 原因句**只描述事实**，⛔ 不写「请再试一次 / 清理后可以重试 / 可以再试一次」（v2 三处已按此改写）—— 把重试写成动作，用户会去找一个不存在的按钮。
> 错误原文**不进文案**（AC9b）：`electron-updater` 原始消息 / 环境变量名（如 `APPIMAGE env is not defined`）/ 文件路径 / 主机名只进本地日志；未知错误统一落 `reason.unknown`。

## 四、不支持应用内更新（`unsupported` 态 · 状态文字 + 一行原因 · AC4b / AC7）

| key                              | zh-CN                                      | en-US                                                                                   |
| :------------------------------- | :----------------------------------------- | :-------------------------------------------------------------------------------------- |
| `settings.update.unsupported`    | 当前安装方式不支持应用内更新               | In-app updates aren't available for this install                                        |
| `settings.update.manual.mac`     | macOS 版需要从下载页安装新版本             | On macOS, install the new version from the download page                                |
| `settings.update.manual.deb`     | deb 版由系统包管理，新版本要从下载页取     | The deb build is managed by your system — get the new version from the download page    |
| `settings.update.manual.dev`     | 开发版没有可用的更新源，新版本请从下载页取 | The development build has no update source — get the new version from the download page |
| `settings.update.manual.unknown` | 这种安装方式的新版本要从下载页安装         | This type of install needs the new version from the download page                       |

> 取用规则（设计稿 §5）：状态文字恒取 `settings.update.unsupported`；第二行原因按 `degradedReason` 取 `manual.mac` / `manual.deb` / `manual.dev`（未打包开发态，**v3 新增**）；`degradedReason` 缺省（形态判定不出）⇒ `manual.unknown` **兜底**，⛔ 不留空行、⛔ 不自造第三种措辞。

## 五、数据护栏（卡 A，AC9）

| key                                  | zh-CN                                                         | en-US                                                                                              |
| :----------------------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| `settings.update.guard.title`        | 有改动还没同步                                                | Some changes haven't synced                                                                        |
| `settings.update.guard.body`         | 还有 {count} 项改动等待同步。更新会重启应用，建议先同步完成。 | {count} change(s) are still waiting to sync. Updating restarts the app, so it's best to sync first |
| `settings.update.guard.syncFirst`    | 先同步再更新                                                  | Sync, then update                                                                                  |
| `settings.update.guard.updateAnyway` | 仍要更新                                                      | Update anyway                                                                                      |

> **卡 A 文案已定稿（arch 2026-11-20 读码）**：未同步队列**跨重启保留**（Dexie `syncQueue` → 冷启动重推）⇒ 采用软提示文案 A；原文案 B（「会丢失且无法恢复」）**作废删除**。⛔ 面向用户**不出现**「失败 / 失败项」（`failedCount` 为内存态、重启清零）；数量取队列长度。

## 六、侧栏弱提示与无障碍

| key                                                                 | zh-CN              | en-US                         |
| :------------------------------------------------------------------ | :----------------- | :---------------------------- |
| `settings.update.settingsWithUpdate`（齿轮 `aria-label` / tooltip） | 设置 · 有可用更新  | Settings · update available   |
| `settings.update.a11y.progress`（`aria-valuetext`）                 | 已下载 {percent}%  | {percent}% downloaded         |
| `settings.update.a11y.progressUnknown`                              | 正在下载，进度未知 | Downloading, progress unknown |

> ⛔ `settings.update.hint.available` 已删除（PM 裁决 · 无界面入口）：弱提示的可访问名 / tooltip 统一用 `settings.update.settingsWithUpdate`；代码侧已于 `415d8e35` 同步删净。

## 七、写作约束（交付校核）

- ⛔ 不出现：`updater` / `autoUpdater` / `sha512` / `releases` 之外的仓库内部路径 / `T734` 类编号。
- ⛔ 不把「重试」写成动作（AC4）：全量检索 `再试一次` / `重试`，只允许出现在「再试 = 点 R1『检查更新』」的语义里；`failed` 态文案只描述事实。
- ⛔ 不出现底层错误原文（AC9b）：`electron-updater` 消息 / 环境变量名 / 文件路径 / 主机名 —— 原因只用原因码映射键。
- ⛔ 不承诺未证实行为：不得写「退出应用时会自动更新」（除非实现断言）；`稍后` 的后果只写「重启应用后生效」。
- ⛔ 不用含糊措辞掩盖风险：护栏文案 A/B 择一以「重启是否丢未同步队列」的**事实**为准（见设计稿 §7）。
- 成功/失败措辞正向：`有新版本` 用中性陈述，不用感叹号、不用「！重要更新」类提示。
- 数字：体积与百分比由实现传入并已本地化格式；**总量未知不得编数字**（不显示 `0 MB`）。