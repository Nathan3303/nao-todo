# 文案（zh-CN / en-US）· 桌面端自我更新 · T734 / Issue #358

> 配套设计稿：`docs/designs/358-desktop-self-update.md`。落点：`packages/shared/locales/{types,zh-CN,en-US}.ts` **三处齐备**（`LocaleKey` 联合类型 + 中英各一）。
> 命名：`settings.update.<语义>`；插值沿用既有风格 `{version}` / `{count}` / `{percent}`。
> 复用既有键：`common.retry`（重试）、`common.cancel`（取消）。⛔ 面向用户禁出现 `updater` / `autoUpdater` / `sha512` / 内部编号 / 本机路径。

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

## 三、失败态（原因 + 动作）

| key                              | zh-CN                        | en-US                                                      |
| :------------------------------- | :--------------------------- | :--------------------------------------------------------- |
| `settings.update.failedCheck`    | 没能检查更新                 | Couldn't check for updates                                 |
| `settings.update.failedDownload` | 下载没完成                   | The download didn't finish                                 |
| `settings.update.failedVerify`   | 更新包校验没通过，已停止安装 | The download didn't pass its check, so it wasn't installed |
| `settings.update.reason.offline` | 当前没有网络连接             | You're offline                                             |
| `settings.update.reason.timeout` | 服务器没有响应，请稍后再试   | The server didn't respond. Please try again                |
| `settings.update.reason.server`  | 更新服务暂时不可用           | The update service is temporarily unavailable              |
| `settings.update.reason.disk`    | 磁盘空间不足，清理后可以重试 | Not enough disk space. Free some space and try again       |
| `settings.update.reason.unknown` | 更新没能完成，可以再试一次   | Something went wrong. You can try again                    |

## 四、平台降级（一行原因，AC7）

| key                          | zh-CN                                  | en-US                                                                                |
| :--------------------------- | :------------------------------------- | :----------------------------------------------------------------------------------- |
| `settings.update.manual.mac` | macOS 版需要从下载页安装新版本         | On macOS, install the new version from the download page                             |
| `settings.update.manual.deb` | deb 版由系统包管理，新版本要从下载页取 | The deb build is managed by your system — get the new version from the download page |

## 五、数据护栏（卡 A，AC9）

| key                                                          | zh-CN                                                         | en-US                                                                                              |
| :----------------------------------------------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| `settings.update.guard.title`                                | 有改动还没同步                                                | Some changes haven't synced                                                                        |
| `settings.update.guard.body`                                 | 还有 {count} 项改动等待同步。更新会重启应用，建议先同步完成。 | {count} change(s) are still waiting to sync. Updating restarts the app, so it's best to sync first |
| `settings.update.guard.syncFirst`                            | 先同步再更新                                                  | Sync, then update                                                                                  |
| `settings.update.guard.updateAnyway`                         | 仍要更新                                                      | Update anyway                                                                                      |
| `settings.update.guard.bodyRisk`（文案 B，仅当重启会丢队列） | 这 {count} 项改动会在重启时丢失，且无法恢复。                 | These {count} change(s) will be lost when the app restarts, and can't be recovered                 |
| `settings.update.guard.updateAnywayRisk`（文案 B）           | 仍然更新（会丢失改动）                                        | Update anyway (changes will be lost)                                                               |

## 六、侧栏弱提示与无障碍

| key                                                                 | zh-CN              | en-US                         |
| :------------------------------------------------------------------ | :----------------- | :---------------------------- |
| `settings.update.hint.available`                                    | 有可用更新         | Update available              |
| `settings.update.settingsWithUpdate`（齿轮 `aria-label` / tooltip） | 设置 · 有可用更新  | Settings · update available   |
| `settings.update.a11y.progress`（`aria-valuetext`）                 | 已下载 {percent}%  | {percent}% downloaded         |
| `settings.update.a11y.progressUnknown`                              | 正在下载，进度未知 | Downloading, progress unknown |

## 七、写作约束（交付校核）

- ⛔ 不出现：`updater` / `autoUpdater` / `sha512` / `releases` 之外的仓库内部路径 / `T734` 类编号。
- ⛔ 不承诺未证实行为：不得写「退出应用时会自动更新」（除非实现断言）；`稍后` 的后果只写「重启应用后生效」。
- ⛔ 不用含糊措辞掩盖风险：护栏文案 A/B 择一以「重启是否丢未同步队列」的**事实**为准（见设计稿 §7）。
- 成功/失败措辞正向：`有新版本` 用中性陈述，不用感叹号、不用「！重要更新」类提示。
- 数字：体积与百分比由实现传入并已本地化格式；**总量未知不得编数字**（不显示 `0 MB`）。