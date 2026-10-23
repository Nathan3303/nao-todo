# DESIGN.md —— nao-todo 设计语言与界面规范

> 适用：面向用户的 **web / desktop** 界面（`apps/web`、`apps/desktop`，二者复用同一组件与 hook）。
> 定位：**C 端消费级应用**（任务 / 清单 / 专注工具），**不是后台管理台**。
> 来源：2026-09-28 冲突面板视觉走查（T338/T339/T340/T342/T343）与实测 token 对比度。
> 约束：**SSOT（Single Source of Truth）= 本文件**；新增页面/组件前请对照文末「检查清单」。

---

## 1. 产品气质

1. **客服向、说人话**：面向用户的界面**不得**裸露内部术语与技术键名（如 `stale` / `OCC` / 败方 / `derivedUpdates` / `name` / `archivedAt` / `revision`），一律映射为用户可读标签与说明。
2. **视觉 C 端化**：避免「表头 + 行 + 网格」式后台排版 ⇒ 卡片 / 分区留白 / 圆角 / 舒展字号 / 更大点击区；主按钮突出、次按钮弱化。
3. **信息分层**：列表（左栏）只承载「名称」级信息；类型 / 状态 / 时间 / ID / 字段差异等技术细节进**详情区**。硬约束 = **信息只迁移、不丢失**。
4. **安全感**：涉及覆盖数据的动作必须给「选择后以谁为准」的说明；危险动作有明确主次与（必要时）二次确认。
5. **不另创体系**：沿用既有 `nue-*` token 与 `nue-ui` 组件；确需新增 token / 组件 ⇒ 先与 PM 确认。

---

## 2. 色彩体系（实测，light 模式，底色 `--nue-primary-color-0` = `#fff`）

| 用途                     | token                                                       | hex                               | 对比度                 | 达标线                                          |
| :----------------------- | :---------------------------------------------------------- | :-------------------------------- | :--------------------- | :---------------------------------------------- |
| 正文                     | `--nue-primary-text-color`（= `--nue-primary-color-800`）   | `#333333`                         | **12.63:1**            | 文本 ≥4.5 ✓                                     |
| 次要文本                 | `--nue-secondary-text-color`（= `--nue-primary-color-600`） | `#666666`                         | **5.74:1**             | 文本 ≥4.5 ✓                                     |
| 边框 / 分隔线            | `--nue-border-color`（= `--nue-divider-color`）             | `#cccccc`                         | 1.61:1                 | 装饰性（不承载语义）                            |
| 三态·图形（色条 / 符号） | `--nue-{success,warning,error}-color-80`                    | `#1b981b` / `#a15912` / `#a12a12` | **3.78 / 5.31 / 7.35** | 图形 ≥3 ✓                                       |
| 三态·文本（文字标签）    | `--nue-{success,warning,error}-color-90`                    | `#178217` / `#8a4d0f` / `#8a240f` | **4.95 / 6.67 / 8.97** | 文本 ≥4.5 ✓                                     |
| ⚠️ 既有债                | `--nue-success-color-60`                                    | `#22c322`                         | **2.36:1**             | **不达标** ⇒ 勿用于文本/图形；用 `-80/-90` 替代 |

**提示（Message / Toast）语义色配对（随 `nue-ui-theme-shadlike@0.13.27` 起）**

> 消息本体改用更深色阶（修复旧映射文本不达标）；上游已附 vitest 对比度自检（10 组）防退化。

| 语义    | 文字 token                | 文字对比度（浅 / 深） | 边框 token               | 边框对比度（浅） |
| :------ | :------------------------ | :-------------------- | :----------------------- | :--------------- |
| success | `--nue-success-color-100` | **5.67 / 8.27**       | `--nue-success-color-80` | **3.25**         |
| warning | `--nue-warning-color-90`  | **5.49 / 7.42**       | `--nue-warning-color-80` | **4.38**         |
| error   | `--nue-error-color-90`    | **6.76 / 6.51**       | `--nue-error-color-80`   | **5.54**         |

⇒ 文字均 **≥4.5**、边框均 **≥3**（图形）✓。**日历撤销失败态**（T368）同步改指 `error -90 / -10 / -80`（与本表同源，不再引用旧 `-70/-60`）。

**按钮 / 徽标 / 表单提示语义色（`DEF-61` 修复后，随 `nue-ui-theme-shadlike@0.13.28` 起）**

> 修复实心三态按钮、破坏性按钮、Badge、Prompt 错误值的对比度；上游已附 vitest 对比度自检防退化。

| 用途                                      | token（映射）                                    | 对比度（浅 / 深） | 达标线                |
| :---------------------------------------- | :----------------------------------------------- | :---------------- | :-------------------- |
| 实心 success 按钮（白字 on 填充）         | `--nue-button-base-color` = `-success-color-100` | **6.60 / 10.51**  | 文本 ≥4.5 ✓           |
| 实心 warning 按钮（白字 on 填充）         | `-warning-color-100`                             | **8.51 / 9.92**   | 文本 ≥4.5 ✓           |
| 实心 error 按钮（白字 on 填充）           | `-error-color-100`                               | **10.93 / 8.69**  | 文本 ≥4.5 ✓           |
| destructive 按钮（文字 / 描边 on 页面底） | `-error-color-80`                                | **7.35 / 6.11**   | 文本 ≥4.5 / 图形 ≥3 ✓ |
| destructive hover 底（其上文字）          | `-error-color-10`                                | **5.54 / 5.55**   | 文本 ≥4.5 ✓           |
| Prompt 值错误（`value-error`）            | `-error-color-70`                                | **6.05 / 5.23**   | 文本 ≥4.5 ✓           |
| Badge（白字 on 底）                       | `-warning-color-80`                              | **5.31 / 8.25**   | 文本 ≥4.5 ✓           |

⇒ 均达「文本 ≥4.5 / 图形 ≥3」。

**三态可辨性（实测结论）**

- 去色（灰阶）两两对比度：success↔warning **1.32** · warning↔error **1.92** · success↔error **2.53** ⇒ **全部 <3:1**。
- 色盲模拟（ΔE76）：protanopia warning↔error **7.4** · deuteranopia **9.1**（橙 / 红几乎重合）。
- ⇒ **颜色 + 符号 + 文字标签三重冗余是必需**，不得仅靠颜色承载语义。

---

## 3. 排版与间距

- 间距刻度（`nue-*`）：`--nue-gap-2xs` 4px · `--nue-gap-xs` 8px · `--nue-gap-sm` 12px · `--nue-gap-df` 16px。
- 字号：`--nue-text-2xs` 10px · `--nue-text-xs` 12px（默认正文/字段） · `--nue-text-sm` 14px（组头/重点） · `--nue-text-md` 18px（详情标题）。
- 行高：正文约 `1.5`；长文本 `1.6`（`overflow-wrap: anywhere` + `white-space: pre-wrap`）。
- **点击区 ≥40px**：列表 / 组头等可点区域 `min-height: 40px`（当前实现使用 `--nue-box-size-sm` = 32px 的处所，若为**主操作行**应提升至 40px）。
    - **已登记例外**（2026-10-22，用户裁定）：移动抽屉 `nue-footer` 内的**设置齿轮**按字形尺寸（≈24px）呈现、不加 40px 命中盒 —— 理由：齿轮与 5 个导航图标同排，256px 抽屉内加 40px 盒会挤压导航；导航图标本身已 ≥40px，齿轮为其补充入口。新例外须在此登记并写明理由，禁止静默破线。
- 密度：字段行间距 8px（改前 4px）；卡片内边距 8–12px。
- 圆角：`--nue-primary-radius`（= 6px）；卡片可用 `--nue-radius-lg`（8px）。

---

## 4. 组件约定

### 4.1 ⭐ 状态占位统一用 `LoadingError`（**硬规则**）

> 组件：`packages/shared/components/loading-error/loading-error.vue`（`<loading-error>` / `<LoadingError>`）
> 先例：`apps/web/src/components/pomodoro/records/index.vue`、`packages/presentation/task/components/task-details/details.vue`

**规则**：**任何内容区域**（列表 / 详情 / 面板段落）出现的 **加载中 / 加载失败 / 空数据** 三态，**一律**使用 `LoadingError` 承载，**不得**自绘空态 / 错误态 DOM 与样式。

- Props：`loading`（默认 **true**，务必显式传）、`loadingMessage`、`error`（布尔，**注意不是字符串**）、`errorMessage`、`empty`（布尔）、`emptyMessage`、`emptyImageSrc`、`emptyImageSize`。
- 优先级：`loading` > `error` > `empty` > 默认插槽。
- **恢复动作**：错误态用 `#error` 具名插槽放「重试」按钮（文案说人话，复用 `common.retry`）；空态可用 `#empty` 插槽。
- 文案一律走 i18n（`emptyMessage` / `errorMessage` / `loadingMessage`），⛔ 不硬编码。
- **区域级 vs 动作级**：`LoadingError` 用于**替换内容区域**的三态；**动作级瞬时反馈**（如「保留失败」）保持内联提示，不替换内容区域。
- 参考实现：`apps/web/src/components/sync/conflict-list.vue`（左栏列表：loading/error/empty；右栏未选中：empty；无字段差异：empty）。

### 4.2 对话框

- 组件：`nue-dialog`（全局注册，见 `apps/web/src/nue-ui-register.ts`）。
- 尺寸：`min(960px, 92vw) × min(620px, 86vh)`；窄窗（`<900px`）`94vw × 90vh`。
- 布局：左右分栏（左栏列表 `clamp(200px,26%,320px)`，右栏详情 `flex:1; min-width:0`）；两栏之间 **1px 竖向分隔**（`--nue-border-color`），**窄窗堆叠时改为横向**。
- 标题 + 条数走 `#header` 插槽（不拼字符串）。
- a11y：`role="dialog"` + `aria-modal="true"` + aria-label；Esc 关闭；打开焦点入框、关闭归还触发按钮。

### 4.3 列表

- 列表行点击区 ≥40px；选中态用背景 + 字重 + `aria-selected`；**同一实体一行**（避免「同一对象多行同时 active」）。
- 分组/折叠可按需用 `nue-collapse`（`apps/web/src/themes/collapse.css`）；若每项对应唯一详情，则折叠无信息可展示 ⇒ 直接用选择列表。

### 4.4 按钮主次

- 主操作：`theme="primary,small"`（如「保留我的修改」）；次操作：`theme="small,ghost"`；纯文本：`theme="pure,small"`。
- 覆盖类动作前给**安全提示**（一句话说明「选择后以谁为准」）。

### 4.5 分段选择（滑块式多选一）—— 实例化组件 `segmented-switch`

> 组件：`apps/web/src/components/calendar/segmented-switch.vue`（**唯一实现 · 单一来源**，T512 自日历「日/月/周」抽出）；测试：`apps/web/src/components/calendar/__tests__/segmented-switch.test.ts`。

**适用**：同一维度下 N 个互斥选项的切换（N ≥ 2，常见 2–3，选项短），需「当前项一眼可见」——如日历「月 / 周 / 日」视图切换、「周起始」。

**不适用**：选项 ≥ 5 或需更多说明 ⇒ 用 `nue-dropdown` 下拉；布尔二态开关 ⇒ `nue-checkbox` / `nue-switch`。

**用法**（纯展示件：状态 / 切换语义由调用方注入）：

- `items`：`{ label, value, testId?, title? }[]`（N 段等分宽）；`modelValue`：当前选中值（未命中时滑块回 0），点击上抛 `update:modelValue`。
- `ariaLabel`：组可访问名（走 i18n 键）；`fill?`：`true` 铺满容器 / `false` 宽度自适应（默认 `true`）；`size?`：`sm`（默认）/ `md`（点击区 40px）；`thumbTestId?`：滑块定位 id。
- 选中迁移 / 幂等切换语义由调用方决定（例：日历视图切换走路由、周起始走 `setWeekStart`）。

**视觉契约**（已锁定；改动须同步本条款与组件测试）：槽底 = 主文字色 **8%** 混合页面底色；指示器 = 页面底色浮起 + **16%** 内描边；选中 = 主文字色加粗；未选中 = 次要文字色；hover = 6% 混合；**180ms 平移 + `prefers-reduced-motion` 降级**。⛔ **只可用既有 `nue-*` token，禁引 `--cal-*`**（日历侧栏在 `.nue-calendar-host` 令牌组之外，T448 根因）。

**a11y**：`role="group"` + `aria-label`；每段 `aria-pressed`；指示器 `aria-hidden` 装饰性；键盘 Tab 可达 + focus 可见。

**三个调用方只允许三轴不同**：段数（N）· 宽度策略（`fill`）· **尺寸（`size`）**；其余视觉 / 交互逐项一致（防漂移）。

**`size`（T521 增补）**：`sm`（默认，现状 28px）/ `md`（段高 = `--nue-box-size-md` ≈ 40px，用于满足 §3「点击区 ≥40px」）。⛔ **只允许用于点击区达标**，不得承载配色 / 圆角 / 字体 / 动效等任何其它差异 —— 那类差异一律视为漂移，须回组件内统一定义。**调用方不得在自身 CSS 里覆盖分段件尺寸**（把差异写在调用处 = 漂移）。

**复用红线**：新增同类「分段多选一」UX ⇒ **一律复用本组件**，不得另写分段样式或另起同类组件。

### 4.6 侧栏变体能力对等（`rail` / 抽屉）

> 结构约定（2026-10-22，用户裁定）：抽屉内**同步状态**为 content 区底部**吸底工具带**（`position: sticky; bottom: 0`，高 48px，左右 padding `--nue-gap-df`）；**设置齿轮在 `nue-footer`**，与导航图标同排。rail 侧仍为「同步状态注入点 + 齿轮」竖排，两者互不影响。

> 出处：`T521`（PRD `docs/prds/2026-10-22-aside-drawer-sync-and-settings.md`）。

**规则**：同一侧栏的多个响应式变体，**只允许摆放位置不同，不允许能力（功能入口）有无不同**。
新增侧栏能力（同步状态 / 设置 / 导航等）须**同时**落在全部变体：共用同一份宿主注册表与单例状态
（**任一时刻至多一个宿主 / 一个对话框实例**），不得在两个变体里各写一套状态机。

---

## 5. 可访问性基线

- 对比度：文本 **≥4.5:1**；图形 / 边框（承载语义者）**≥3:1**。
- **三重冗余**：状态不得仅靠颜色（颜色 + 符号 + 文字标签）。
- 键盘可达：可点元素需可 Tab 聚焦、focus 可见；对话框 Esc 关闭、焦点闭环与归还。
- 语义：对话框 `role="dialog"` / `aria-modal`；列表项 `aria-selected`。
- 长内容：可截断 + 可展开（`--nue-text-*` + `text-overflow`）。

---

## 6. i18n 约定

- 文案位于 `packages/shared/locales/{types,zh-CN,en-US}.ts`，**三处齐备**（`LocaleKey` 联合类型 + 中英各一）。
- 键命名：`模块.区域.语义`（如 `sync.conflict.metaTable`）；字段标签 `sync.conflict.field.<name>`。
- **死键守护**：`apps/web/src/components/sync/__tests__/conflict-ux.test.ts` 静态扫描组件源码（`.vue` + 同目录 `.ts`）校验「组件引用的键均已定义」且「零死键」。
- **字段名 → 可读标签**：新增字段在 `apps/web/src/components/sync/conflict-field-labels.ts` 的 `FIELD_LABEL_KEYS` 增一行 + 上述三处加键；未映射字段走 `humanizeField` 可读回退（⛔ 不裸露 raw `/camelCase`）。

---

## 7. 危险 / 覆盖类动作

- 覆盖数据的选择必须显式（如「我的修改 / 云端最新」），不得默认静默覆盖。
- 主按钮 = 更保全用户成果的一侧；次按钮 = 另一方；给一句话后果说明。
- 破坏性动作（删除 / 永久覆盖）应加二次确认或醒目样式。

---

## 8. 「新增页面 / 组件」检查清单

- [ ] 面向用户文案**说人话**（无内部术语 / 技术键名）
- [ ] 布局用**卡片 / 留白 / 圆角**，非「表头 + 行 + 网格」
- [ ] 内容区域的 loading / error / empty **全部用 `LoadingError`**（文案走 i18n、错误态有恢复动作）
- [ ] 对比度：文本 ≥4.5:1、图形 ≥3:1（用 `-80` 图形 / `-90`–`-100` 文本，避开 `-60` success；提示 Message 见 §2「提示语义色配对」）
- [ ] 状态**三重冗余**（颜色 + 符号 + 文字标签）
- [ ] 可点区 ≥40px；键盘可达 + focus 可见；对话框 Esc / 焦点归还 / `role=dialog`
- [ ] 主 / 次按钮分明；覆盖类动作有安全提示
- [ ] 新增 i18n 键三处齐备；字段标签走映射（未映射有可读回退）
- [ ] ⛔ 未新增色板 / 组件体系（如需新增 ⇒ 先报 PM）
- [ ] 分段多选一 UX ⇒ **复用 `segmented-switch`**（§4.5 单一来源），不另写分段样式
- [ ] 视口 / 安全区：不以裸静态视口单位作高度基、不用含滚动条宽度的视口单位作宽度基；安全区改动只落 `themes/safe-area.css`（见 §9）
- [ ] 移动端红线：`packages/presentation-react` / `apps/mobile` 不随桌面 / Web 需求改动

---

## 9. 安全区与视口基线（Web / 手机浏览器）

> 出处：`DEF-79` / `T519`（PRD `docs/prds/2026-10-22-web-mobile-safe-area.md`）。
> 适用：`apps/web` 与 `apps/desktop` 共用的主题（`apps/web/src/themes`，桌面端 `@` 别名指向同一目录）。

- **前提**：`apps/web/index.html` 的 viewport meta 必须含 `viewport-fit=cover` —— 否则 iOS Safari 下 `env(safe-area-inset-*)` 恒为 `0`，任何纯 CSS 安全区方案空转。
- **单一视口基**：`html`（`.nue-html`）用动态视口 `100dvh`；`body` / `#app` 一律 `100%`（相对父级）。**不得**出现「父用静态视口、子用动态视口」的混基，也不得写裸静态视口高度或含滚动条宽度的视口单位（源级守卫：`apps/web/src/themes/__tests__/safe-area.test.ts`）。
- **降级取向（可用性优先于观感）**：引擎不支持 `100dvh` 时该声明被丢弃，落到主题 reset 的静态视口，并由 `@supports not (height: 100dvh)` 把 `html` 恢复为可滚动 ⇒ 保证「末行可滚到底」，不回到「被裁且不可滚」。
- **安全区内缩**：四向 `env(safe-area-inset-*, 0px)` **集中**在 `apps/web/src/themes/safe-area.css`，不得散落到组件 `<style>`：
    - 外壳（`body`）四向 padding ⇒ 列表末行 / 空态 / 错误态不落刘海与手势条；
    - 覆盖层（`.nue-overlay`，经 Teleport 挂到 fixed 的 popup pool，**不继承** `body` padding）自身贴合可视视口并在内部四向内缩；窄屏（≤400px）贴底抽屉的底部留白取 `max(var(--nue-padding-df), env(safe-area-inset-bottom, 0px))`。
- **桌面 / Electron 零变化**：`env()` 恒为 `0`、动态视口高度等于静态视口高度、popup pool 位于 `(0, 0)` 且页面不滚动 ⇒ 上述声明全部解析为改动前的数值（验收硬闸门，见 PRD AC4）。
- **加载态**：高度相对父级（`height="100%"`），不以视口高度为基线。
- **已知边界**：iOS Safari 15.0–15.3 支持安全区但无动态视口 ⇒ 列表靠「静态视口 + 页面滚动」保证可滚到底；覆盖层不再依赖视口单位（`position: fixed` + `inset: 0`），安全区仍由 `env()` 内缩 —— 极端旧引擎的定位精度以真机为准，但不比改动前更差。

---

## 参考

- 冲突面板实现：`apps/web/src/components/sync/{conflict-dialog,conflict-list}.vue` · `conflict-diff.ts` · `conflict-field-labels.ts`
- 状态占位组件：`packages/shared/components/loading-error/loading-error.vue`
- 主题 token：`nue-ui-theme-shadlike`（`--nue-*`，light：`--nue-dark-switch:0`）
- 走查证据：`docs/qa/2026-09-28-t337-conflict-visual-seed.md`