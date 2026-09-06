# 视觉定制（customize）

NueUI 视觉由"设计 token（CSS 变量）+ 组件级 CSS 变量 + theme 修饰类"构成。定制时按这个顺序从轻到重：

1. **theme 修饰类**（只换"皮"，零 CSS）；
2. **覆盖 CSS 变量**（换色/间距/圆角等 token）；
3. **scoped 样式 + 类名**（最后手段）。

## 1. theme 属性：给组件换风格

`theme` 是全库组件通用的 prop，接受：

- 字符串：`theme="primary"`；
- 多个主题逗号分隔：`theme="primary,round"`（等同于数组/对象形式，见 features/theme 文档）。

它做的是给元素追加 `nue-<组件>--<名称>` 修饰类——**具体哪些值可用、长什么样，以该组件的文档/演示为准**。常见例子：

- 按钮：`primary`、`ghost`、`icon`（纯图标方钮）、`round`（胶囊）、`pure`、`small`……可组合：`theme="icon,ghost,small"`；
- 很多组件有预置的语义/尺寸/状态修饰（文档里叫"主题/状态"）。传了不存在的值不会有样式报错，只是没效果——先查文档里该组件支持哪些。

> 注意：`theme` 不是"直接给颜色"。想上自定义色，用 CSS 变量覆盖（下节）。

## 2. CSS 变量：设计 token 一览

全局 token 定义在主题包的 `src/global/variables.css`（发布物 `nue-ui-theme-shadlike/dist/global/index.css`），核心几类：

| 类别        | 变量示例                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| 品牌/语义色 | `--nue-primary-color-0..1000`、`--nue-success-color-*`、`--nue-warning-color-*`、`--nue-error-color-*`（数值越大越深） |
| 文本色      | `--nue-primary-text-color`、`--nue-secondary-text-color`、`--nue-disabled-color`                                       |
| 字号        | `--nue-text-2xs/…/sm/df/md/lg/xl/…`（`--nue-text-df` 即 1rem）                                                         |
| 间距        | `--nue-gap-xs/sm/df/md/lg`、`--nue-padding-*`、`--nue-primary-gap`                                                     |
| 圆角/阴影   | `--nue-primary-radius`、`--nue-primary-shadow`                                                                         |
| 控件高度    | `--nue-box-size-xs/sm/df/md/lg`                                                                                        |
| 动画        | `--nue-animation-duration(-short/-long)`、`--nue-animation-timing-function`                                            |
| 暗色开关    | `--nue-dark-switch`（0=浅色 1=深色；配色体系自动翻转明度）                                                             |

**用法**：在样式里引用 token 而不是写死数值/色值，暗色模式与换肤才自动生效。例如：

```css
.my-toolbar {
    gap: var(--nue-gap-sm);
    background-color: var(--nue-primary-color-100);
    color: var(--nue-primary-text-color);
}
```

### 换库主色（全局换肤）

```css
:root {
    --nue-brand-hue: 210; /* 主色相：默认红(0)，换蓝(210) */
    --nue-primary-radius: 0.5rem; /* 全局圆角 */
    --nue-primary-font-family: 'Inter', sans-serif; /* 字体 */
}
```

覆盖需放在主题样式之后引入。更多可定制项（完整色阶、暗色自动派生原理）见主题包 README：`packages/themes/shadlike/README.md`。

### 深色模式

体系内建：给 `:root`（或指定容器）设 `--nue-dark-switch: 1` 即切深色，`0` 回浅色：

```ts
// 跟随系统或手动切换
document.documentElement.style.setProperty('--nue-dark-switch', isDark ? '1' : '0')
```

只要你自己的样式用了上面的 token（而非写死颜色），深浅色下都会自动协调。

## 3. 局部微调一个组件

组件把"可定制维度"暴露成**组件级 CSS 变量**（命名 `--nue-<组件>-<属性>`，如 `--nue-button-*`、`--nue-icon-*`），多数可以直接在实例上覆盖：

```vue
<!-- 单个按钮改字号（覆盖其组件级变量默认值） -->
<nue-button class="my-btn" theme="primary">确定</nue-button>

<style scoped>
.my-btn {
    --nue-button-font-size: var(--nue-text-md); /* 覆盖默认字号变量 */
    color: var(--nue-primary-text-color);
}
</style>
```

> 某变量是否存在、默认值多少，直接看主题源码对应 css：`packages/themes/shadlike/src/components/<name>.css`（变量默认值集中声明在该文件顶部块）；组件 :style 输出的变量在组件源码里找 `--nue-` 字符串也行。文档站的演示（如 theme 专题 features/theme 页）是判断"改哪层"的最好参照。

## 4. 兜底：类名 + 局部样式

组件根元素上有稳定的 BEM 类（`nue-button`、`nue-dialog`…），给组件挂自定义 class 后用 scoped 样式（或非 scoped + 更高优先级）即可覆盖。注意：

- 写死色值 = 深色模式破功。**一律引用 token**；
- 库内组件在文档/演练场里做演示时，改外观优先覆盖变量/theme，而非复制整段组件 css。

## 决定路径速查

| 诉求                                     | 做法                                       |
| ---------------------------------------- | ------------------------------------------ |
| 组件换个现成风格（primary/ghost/round…） | `theme` prop（查该组件文档支持值）         |
| 全局主色/圆角/字体                       | 覆盖 `:root` token（`--nue-brand-hue` 等） |
| 全站深浅色切换                           | `--nue-dark-switch`                        |
| 单个实例微调                             | 实例上覆盖 `--nue-<组件>-*` 变量           |
| 大改/写死视觉                            | 挂 class + scoped 样式（尽量引用 token）   |