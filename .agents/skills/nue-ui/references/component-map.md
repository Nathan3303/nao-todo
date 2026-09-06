# 组件选型地图（component map）

按"这个界面块想实现什么"选组件。**动手前务必打开该组件的文档页**看完整 API 与演示：

- 文档页位置：`apps/document/tutorial/<类别>/<组件>/index.md`（在线：https://nathan3303.github.io/nue-ui/ ）
- 组件文档目录类别：basic（基础）/ data（数据展示）/ form（表单）/ feedback（反馈）/ navigation（导航）/ others（其他）；使用姿势见 `tutorial/usage/*`。
- 仓库内"现成用法样例"可以直接抄：同目录下的 `*.vue` 演示文件。

通用速记（所有组件）：

- `theme` prop 全组件通用（追加修饰类）；props 在文档"属性"表格、模板里写 kebab-case（如 `allow-close-by-overlay`）；事件在"事件"表格，监听写 `@after-close`。
- v-model 组件：`model-value` ⇄ `update:modelValue`，通常还有 `change`、`clear`。
- 尺寸约定：不少组件 `size` 只有 `'small' | 'large'`（缺省为默认档）。

## 布局与骨架

| 组件                                                                   | 用途                                                                | 核心                                                                                                                | 文档              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `<nue-div>`                                                            | 万能 flex 容器：横排/竖排、对齐、间距、分割线。几乎每个画面都在用   | `direction`/`vertical`、`align`、`justify`、`flex`、`wrap`、`gap`、`divider`、`inline`                              | basic/div         |
| `<nue-text>`                                                           | 排版文本：标签(tag)、字号、颜色、字重、对齐、多行截断               | `tag`、`size`、`color`、`weight`、`clamped`（行数）、`decoration`                                                   | basic/text        |
| `<nue-container>` + `<nue-header/aside/main/content/footer/separator>` | 应用壳：上/下/左/右区域布局；aside 可设宽/折叠，content `fill` 撑满 | container 设 `height`；header/footer 设 `height`；aside 设 `width`/`min-width`/`collapsed-width`；content 设 `fill` | basic/container   |
| `<nue-divider>`                                                        | 分割线（水平/垂直、带文字）                                         | `direction`、`content-position` 等（看文档）                                                                        | others/divider    |
| `<nue-scroll-bar>`                                                     | 自定义滚动条区域                                                    | `height` 等                                                                                                         | others/scroll-bar |

## 基础交互元素

| 组件                 | 用途                               | 核心                                                                                                                           | 文档         |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| `<nue-button>`       | 按钮。常见用法直接看文档演示       | `theme`（如 `primary`/`ghost`/`icon`/`round`/`pure`，可逗号组合）、`size`、`icon`、`loading`、`disabled`、`flat`；事件 `click` | basic/button |
| `<nue-button-group>` | 按钮组（统一 size/disabled）       | 包若干 `<nue-button>`                                                                                                          | basic/button |
| `<nue-link>`         | 链接（href 或 vue-router `route`） | `href`、`route`、`icon`、`disabled`                                                                                            | basic/link   |
| `<nue-icon>`         | 图标（iconfont 字体）              | `name`（图标名见文档"所有图标"）、`size`、`color`、`spin`（旋转）、`spinSpeed`                                                 | basic/icon   |

## 表单

| 组件                                   | 用途               | 核心                                                                                                                               | 文档             |
| -------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `<nue-input>`                          | 文本/数字/密码输入 | `type`（含 `textarea`）、v-model、`placeholder`、`clearable`、`allow-show-password`、`icon`、`counter`（字数统计）、`size`、`flex` | form/input       |
| `<nue-textarea>`                       | 文本域             | v-model、`rows`、`autosize`、`maxlength`、`counter`、`resize`                                                                      | form/textarea    |
| `<nue-select>` + `<nue-select-option>` | 下拉选择           | select：v-model、`placeholder`、`clearable`；option：`label`/`value`（v-for 渲染）                                                 | form/select      |
| `<nue-checkbox>`                       | 复选（布尔）       | v-model（boolean）                                                                                                                 | form/checkbox    |
| `<nue-switch>`                         | 开关               | v-model（boolean），`loading`、`disabled`                                                                                          | form/switch      |
| `<nue-date-picker>`                    | 日期/日期时间选择  | `type`（`date`/`datetime`）、v-model、`clearable`；**输出为 ISO 8601 字符串**                                                      | form/date-picker |
| `<nue-calendar>`                       | 日历面板           | `type`（date/datetime）                                                                                                            | form/calendar    |

## 反馈

| 组件                         | 用途                                           | 核心                                                                                                                                              | 文档             |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `<nue-dialog>`               | 模态对话框                                     | `v-model`(boolean)、`title`；插槽 `header`/`content`/`footer`（都解构出 `close`）/`reset`；事件 `before-open/after-open/before-close/after-close` | feedback/dialog  |
| `<nue-drawer>`               | 抽屉                                           | `v-model`、`title`、`open-from`（left/right/top/bottom）、`span`、`allow-close-by-overlay`；插槽同 dialog                                         | feedback/drawer  |
| `<nue-tooltip>`              | 悬浮提示（包裹目标）                           | `content`、`placement`（top/bottom/left/right 及 -start/-center/-end）、`show-triangle`                                                           | feedback/tooltip |
| `NueMessage(...)` **方法**   | 轻提示（toast）                                | `NueMessage({ message, type: 'success'                                                                                                            | 'error'          | 'warning' | 'info' | 'log', duration, icon })`；快捷 `NueMessage.success(message, duration?, icon?, size?)` 等 | feedback/message |
| `NueConfirm({...})` **方法** | 确认框，返回 Promise `[isByCancel, result]`    | payload：`title`/`content`/`confirm-button-text`/`cancel-button-text`/`on-confirm`（支持异步）/`unuse-cancel-button`/`animation`                  | feedback/confirm |
| `NuePrompt({...})` **方法**  | 输入确认框，Promise `[isByCancel, inputValue]` | payload：`title`/`placeholder`/按钮文案                                                                                                           | feedback/prompt  |

## 数据展示

| 组件                                     | 用途                 | 核心                                                                                                                                                           | 文档                 |
| ---------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `<nue-badge>`                            | 角标/徽标            | `value`、`max`（超出折叠如 99+）、`dot`（小红点）、`hidden`                                                                                                    | data/badge           |
| `<nue-avatar>`                           | 头像                 | `src`、`icon`、`size`、`rounded`                                                                                                                               | data/avatar          |
| `<nue-progress>`                         | 进度（线/环/仪表盘） | `type`（line/circle/dashboard）、`percentage`、`color`、`show-inner-text`；满时 `full` 事件                                                                    | data/progress        |
| `<nue-table>`                            | 表格                 | `:data` 行数组 + `:columns`（key/title/width/align/sortable）；`cell-{key}`/`header-{key}`/`empty` 插槽；排序 `sort-change`、行点击 `row-click`；空态/加载内置 | data/table           |
| `<nue-empty>`                            | 空状态占位           | `description`、`image-src`、`image-size`                                                                                                                       | data/empty           |
| `<nue-collapse>` + `<nue-collapse-item>` | 折叠面板/手风琴      | collapse：v-model（激活 name 数组）、`accordion`；item：`title`/`name`                                                                                         | data/collapse        |
| `<nue-marquee>`                          | 跑马灯               | 看文档                                                                                                                                                         | data/marquee         |
| `<nue-infinite-scroll>`                  | 滚动到底加载         | `height`、`loading`、`disabled`；事件 `load-more`                                                                                                              | data/infinite-scroll |

## 导航

| 组件                                         | 用途                   | 核心                                                                                                                                                          | 文档                            |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `<nue-dropdown>` + `<nue-dropdown-item>`     | 下拉菜单（点击/hover） | dropdown：`trigger-text`/`text`、`trigger-type`（click/hover）、`placement`、`close-when-executed`；item：`text`/`icon`/`execute-id`；dropdown 事件 `execute` | navigation/dropdown             |
| `<nue-breadcrumb>` + `<nue-breadcrumb-item>` | 面包屑                 | 看文档                                                                                                                                                        | —（组件存在；文档页以站内为准） |

## 未文档化但存在（谨慎使用）

`<nue-checkbox-group>`/`<nue-button-group>` 之外的组件如 `NuePopupPool`、`NueOverlay` 多用于库内弹层基建，日常写画面基本用不到；`nue-checkbox-group`（把若干 NueCheckbox 按 name 聚合）在库内无文档页，需要时可参考源码 `packages/components/checkbox-group/` 的注释与其测试再决定是否使用。