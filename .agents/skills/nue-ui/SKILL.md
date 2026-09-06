---
name: nue-ui
description: 使用 NueUI 组件库（Vue3，nue-ui + nue-ui-theme-shadlike）编写界面/页面/画面时的应用指南。当用户要求"用 NueUI 搭页面/后台/表单/弹窗流程""实现某个界面效果""某个组件怎么用/传什么参数""改组件用法或样式（theme/暗色/间距）"——目标是消费现有组件写出界面，而不是改组件库源码——请使用本技能。典型触发：写 VitePress 组件文档的演示、做 demo 页/演练页、用 NueUI 组件搭一个管理系统界面、把某组件换成合适的另一个、排查"组件没样式/图标不显示/对话框不弹"等使用问题。
---

# NueUI 组件使用技能

本技能教你**用现成 NueUI 组件编写画面**（消费方视角）：选对组件、按组件约定传参、拼出页面与交互流程、做视觉微调。

> 若任务目标是**开发/修改组件库本身**（改 packages/components 源码、主题 CSS 内部、加新 NueXxx 组件），这不是本技能的范围。

先读"三条心智模型"与"编写流程"，再按"任务路由表"按需读取 references/。完整组件 API 以文档为准——本仓库 `apps/document/tutorial/` 下每个组件都有一页带**实时演示**的文档，那才是权威出处；下面的内容负责告诉你该读哪页、以及组件用法有哪些共性。

## 三条心智模型

**1. 组件库本身不带样式，样式要靠显式引入主题 CSS。**
`nue-ui` 只含组件逻辑；视觉来自 `nue-ui-theme-shadlike`。凡是"组件出来了但没样式/长得很素"，第一反应就是查样式有没有引入（见 get-started.md）。图标另需 iconfont 字体样式，否则 `<nue-icon>` 空白。

**2. 全库组件共享一套用法约定。**

- 全局注册（`app.use(NueUI)` 或 resolver 自动导入）后，模板里直接写 `<nue-button>`（kebab-case）或 `<NueButton>` 都行；
- 状态类组件走 v-model：`modelValue` + `update:modelValue`，一般还带 `change`/`clear` 等辅助事件；
- 几乎所有组件都有 `theme` prop（GlobalProps 约定）——但注意 theme 是**追加修饰类名**的机制（如按钮的 `primary`/`success`/`ghost`/`icon`），不是直接写颜色的地方；自定义样式另见 customize.md；
- props/事件在组件文档页底部都有"属性与事件"表格，改动接口前先看它。

**3. 组件分成两类用法，别混。**

- **标签组件**：布局/表单/展示类，写 `<nue-xxx>` 用；
- **方法调用**：`NueMessage` / `NueConfirm` / `NuePrompt` 是**函数**不是组件——要 `import { NueMessage } from 'nue-ui'` 后以 `NueMessage.success(...)`、`NueConfirm({...}).then(...)` 方式调用。想当然地把它们当标签写在模板里是新手最常犯的错。

## 编写一个画面的推荐流程

1. **拆需求 → 选型**：把界面拆成"布局骨架 / 区块 / 交互反馈"，对照 `references/component-map.md` 选组件（例如"顶部+侧栏+内容"用 Container 家族；表单用 NueInput/NueSelect/NueSwitch；确认删除用 NueConfirm；成功提示用 NueMessage）。
2. **抄骨架 → 改参数**：在 `references/recipes.md` 找最接近的画面套路复制改，或在对应文档页的演示里改。**动手前先打开该组件文档页**（本仓库 `apps/document/tutorial/<类别>/<组件>/index.md`），对着"属性与事件"表格核对你用的 props/事件名（模板里写 kebab-case，如 `allow-close-by-overlay`）。
3. **交互细节**：v-model 绑定用 `ref`/`reactive`；需要二次确认/结果提示的用 Confirm/Prompt/Message 方法流。
4. **视觉微调**：theme 修饰类 → CSS 变量覆盖 → 少量 scoped 样式，按这个顺序来（见 customize.md）。
5. **验证**：仓库内起 `pnpm document dev`（或 `pnpm playground dev`）看真实效果；在线文档也能直接调演示。

## 任务路由表

| 任务                                           | 读取                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| 不知道装什么、怎么引入/注册、样式引哪份        | `references/get-started.md`                               |
| 这个场景该用哪个组件、各组件核心 props         | `references/component-map.md`                             |
| 拼页面：后台布局/表单/弹窗流/列表加载/下拉菜单 | `references/recipes.md`                                   |
| 改外观：theme、颜色、间距、暗色模式            | `references/customize.md`                                 |
| 某个组件完整 API/演示/边界行为                 | 打开它的文档页（定位方法见 component-map.md 与 api 速查） |

## 使用侧快速纠错表

- **组件渲染出来但没有样式** → 主题 CSS 没引入：`import 'nue-ui-theme-shadlike/dist/index.css';`（按需用法见 get-started.md）。
- **`<nue-icon>` 空白 / 图标不显示** → 缺 iconfont 字体样式：`import 'nue-ui-iconfont/dist/iconfont.css';`；或 `name` 不在图标列表里（图标名见 Icon 文档"所有图标"）。
- **模板里用 `NueMessage`/`NueConfirm` 不渲染** → 它们是方法不是组件，见心智模型 3 与 recipes.md 的调用写法。
- **NueButton 写了颜色不生效 / 想换主色** → 颜色走 theme 修饰类 + CSS 变量体系，别直接塞 style；见 customize.md（换库主色是覆盖 `--nue-brand-hue` 等 token）。
- **对话框/抽屉 v-model 不弹** → 组件状态由 `v-model` 控制，确认绑定的是 `ref(false)` 且变量已置 `true`；`v-model` 的语义即 `modelValue`（文档表格里通常写作 `model-value`）。
- **日期值"多了一段 T...Z"** → NueDatePicker/Calendar 输出 ISO 8601 字符串是设计如此（见 date-picker 文档的格式警告），展示时自行截取/格式化。
- **选项类组件（Select/Dropdown）选项不出现** → Select 要用 `<nue-select-option>` 子组件（或 `options` 数据源写法按文档），Dropdown 用 `<nue-dropdown-item>`，别用原生 `<option>`/`<li>` 混搭（除非文档演示如此）。
- **页面里个别组件想改点样式** → 先 theme 修饰类 → CSS 变量覆盖 → scoped 样式，逐级放大，见 customize.md。

## References（按需读取）

- `references/get-started.md` — 安装/引入/注册三种方式、样式与图标字体引入、仓库内写 demo 的注意点
- `references/component-map.md` — 按界面任务选组件：每个组件的用途、核心 props/事件、对应文档页
- `references/recipes.md` — 画面套路：应用壳、表单页、弹窗/确认/消息流、列表与加载、下拉菜单等可复制片段
- `references/customize.md` — theme 属性、CSS 变量 token、暗色模式、常见定制做法

> 在线文档：https://nathan3303.github.io/nue-ui/ （本仓库内则以 `apps/document/tutorial/` 下各组件 index.md + 演示为同一内容源）