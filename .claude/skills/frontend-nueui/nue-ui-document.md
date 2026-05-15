# NueUI Skill

## 概述

NueUI 是一个基于 Vue 3 的 UI 组件库，支持按需导入和完整导入。

## 安装

```shell
# npm
npm install nue-ui

# pnpm
pnpm install nue-ui

# yarn
yarn add nue-ui
```

## 快速开始

### 完整导入

```typescript
// main.ts
import { createApp } from 'vue';
import NueUI from 'nue-ui';
import 'nue-ui/dist/index.css';

const app = createApp(App);
app.use(NueUI);
app.mount('#app');
```

### Volar 支持

```json
// tsconfig.json
{
    "compilerOptions": {
        "types": ["nue-ui/dist/global"]
    }
}
```

### 按需导入

```typescript
import { NueButton, NueText } from 'nue-ui';
```

## 组件列表

### 基础组件 (Basic)

| 组件             | 说明     |
| ---------------- | -------- |
| `NueButton`      | 按钮     |
| `NueButtonGroup` | 按钮组   |
| `NueIcon`        | 图标     |
| `NueText`        | 文本     |
| `NueLink`        | 链接     |
| `NueContainer`   | 容器     |
| `NueHeader`      | 头部     |
| `NueMain`        | 主要区域 |
| `NueAside`       | 侧边栏   |
| `NueFooter`      | 底部     |
| `NueContent`     | 内容     |
| `NueSeparator`   | 分隔符   |
| `NueDivider`     | 分割线   |
| `NueDiv`         | 弹性盒子 |

### 表单组件 (Form)

| 组件               | 说明       |
| ------------------ | ---------- |
| `NueInput`         | 输入框     |
| `NueTextarea`      | 文本域     |
| `NueSelect`        | 选择器     |
| `NueSelectOption`  | 选择器选项 |
| `NueCheckbox`      | 复选框     |
| `NueCheckboxGroup` | 复选框组   |
| `NueSwitch`        | 开关       |

### 数据展示 (Data)

| 组件                | 说明       |
| ------------------- | ---------- |
| `NueBadge`          | 徽标       |
| `NueAvatar`         | 头像       |
| `NueProgress`       | 进度条     |
| `NueCollapse`       | 折叠面板   |
| `NueCollapseItem`   | 折叠面板项 |
| `NueMarquee`        | 跑马灯     |
| `NueEmpty`          | 空状态     |
| `NueInfiniteScroll` | 无限滚动   |

### 反馈组件 (Feedback)

| 组件         | 说明     |
| ------------ | -------- |
| `NueDialog`  | 对话框   |
| `NueDrawer`  | 抽屉     |
| `NueTooltip` | 文字提示 |

### 导航组件 (Navigation)

| 组件                | 说明       |
| ------------------- | ---------- |
| `NueBreadcrumb`     | 面包屑     |
| `NueBreadcrumbItem` | 面包屑项   |
| `NueDropdown`       | 下拉菜单   |
| `NueDropdownItem`   | 下拉菜单项 |

### 增强组件 (Enhance)

| 组件                | 说明       |
| ------------------- | ---------- |
| `NuePopupPool`      | 弹出层池   |
| `NueOverlay`        | 遮罩层     |
| `NueMessageWrapper` | 消息包装器 |

## 组件类型

### NueButton

```typescript
type NueButtonSize = 'small' | 'large';

interface NueButtonProps {
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
    loadingIcon?: string;
    title?: string;
    alignment?: 'start' | 'center' | 'end';
    flex?: string;
    size?: NueButtonSize;
    useThrottle?: boolean;
    throttleDuration?: number;
    flat?: boolean;
    type?: 'submit' | 'reset' | 'button';
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueInput

```typescript
type NueInputType = 'text' | 'password' | 'number' | 'email' | 'textarea';
type NueInputCounter = 'off' | 'word-limit' | 'word-left' | 'both';
type NueInputShape = 'rounded' | 'noshape';

interface NueInputProps {
    type?: NueInputType;
    modelValue?: string | number;
    id?: string;
    shape?: NueInputShape;
    icon?: string;
    placeholder?: string;
    maxlength?: string;
    disabled?: boolean;
    readonly?: boolean;
    clearable?: boolean;
    allowShowPassword?: boolean;
    counter?: NueInputCounter;
    width?: string;
    size?: 'small' | 'large';
    debounceTime?: number;
    flex?: string | boolean;
    name?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueSelect

```typescript
type NueSelectValue =
    | string
    | number
    | boolean
    | Record<never, never>
    | Array<never>
    | null
    | undefined;

interface NueSelectOption {
    label: string;
    value: NueSelectValue;
    icon?: string;
}

interface NueSelectProps {
    modelValue?: NueSelectValue;
    placeholder?: string;
    size?: 'small' | 'large';
    disabled?: boolean;
    clearable?: boolean;
    persistent?: boolean;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueDialog

```typescript
interface NueDialogProps {
    modelValue?: boolean;
    teleportTo?: string;
    title?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueDrawer

```typescript
interface NueDrawerProps {
    modelValue?: boolean;
    title?: string;
    span?: string;
    minSpan?: string;
    allowCloseByOverlay?: boolean;
    openFrom?: 'left' | 'right' | 'top' | 'bottom';
    teleportTo?: string;
    onClose?: (done: () => void) => unknown;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueMessage (函数调用)

```typescript
type NueMessageType = 'success' | 'error' | 'warning' | 'info' | 'log';
type NueMessageSize = 'small' | 'large';

interface NueMessageCallerPayload {
    message: string;
    type?: NueMessageType;
    duration?: number;
    icon?: string;
    size?: NueMessageSize;
}

interface NueMessageCaller {
    (payload: NueMessageCallerPayload): void;
    success: (message: string, duration?: number, icon?: string, size?: NueMessageSize) => void;
    error: (message: string, duration?: number, icon?: string, size?: NueMessageSize) => void;
    warn: (message: string, duration?: number, icon?: string, size?: NueMessageSize) => void;
    info: (message: string, duration?: number, icon?: string, size?: NueMessageSize) => void;
    log: (message: string, duration?: number, icon?: string, size?: NueMessageSize) => void;
}

declare const NueMessage: NueMessageCaller;
```

### NueConfirm (函数调用)

```typescript
interface NueConfirmCallerPayload {
    wrapperId?: string;
    title?: string;
    content?: string | VNode;
    confirmButtonText?: string;
    cancelButtonText?: string;
    unuseCancelButton?: boolean;
    loading?: boolean;
    animation?: NuePopupItemAnimation;
    closeAnimation?: NuePopupItemAnimation;
    onConfirm?: () => unknown;
    beforeOpen?: () => unknown;
    afterOpen?: () => unknown;
    afterConfirm?: () => unknown;
    afterCancel?: () => unknown;
    beforeClose?: () => unknown;
    afterClose?: () => unknown;
    theme?: string | string[] | Record<string, boolean>;
}

declare const NueConfirm: (payload: NueConfirmCallerPayload) => Promise<[boolean, unknown]>;
```

### NuePrompt (函数调用)

```typescript
interface NuePromptCallerPayload {
    wrapperId?: string;
    title?: string;
    description?: string;
    placeholder?: string;
    inputType?: 'text' | 'password' | 'number' | 'email' | 'textarea';
    inputValue?: string | number;
    confirmButtonText?: string;
    cancelButtonText?: string;
    validator?: (value: unknown) => string | Error | null;
    onConfirm?: (value: unknown, done: () => void) => string | Error | null;
    afterConfirm?: () => void | Promise<void>;
    afterCancel?: () => void | Promise<void>;
    beforeOpen?: () => void;
    afterOpen?: () => void;
    beforeClose?: () => void;
    afterClose?: () => void;
    theme?: string | string[] | Record<string, boolean>;
}

declare const NuePrompt: (payload: NuePromptCallerPayload) => Promise<[boolean, unknown]>;
```

### NueTooltip

```typescript
interface NueTooltipProps {
    content?: string;
    placement?:
        | 'top'
        | 'top-start'
        | 'top-end'
        | 'bottom'
        | 'bottom-start'
        | 'bottom-end'
        | 'left'
        | 'left-start'
        | 'left-end'
        | 'right'
        | 'right-start'
        | 'right-end';
    size?: 'small' | 'normal' | 'large';
    showTriangle?: boolean;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueDropdown

```typescript
type NueDropdownTriggerType = 'click' | 'hover';
type NueDropdownSize = 'small' | 'large';

interface NueDropdownProps {
    transparent?: boolean;
    teleportTo?: string;
    text?: string;
    triggerText?: string;
    disabled?: boolean;
    triggerType?: NueDropdownTriggerType;
    size?: NueDropdownSize;
    placement?:
        | 'top'
        | 'top-start'
        | 'top-end'
        | 'bottom'
        | 'bottom-start'
        | 'bottom-end'
        | 'left'
        | 'left-start'
        | 'left-end'
        | 'right'
        | 'right-start'
        | 'right-end';
    closeWhenExecuted?: boolean;
    group?: string;
    beforeExecute?: () => void;
    afterExecute?: () => void;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueCheckbox

```typescript
interface NueCheckboxProps {
    modelValue?: boolean;
    label?: string;
    name?: string;
    size?: 'small' | 'large';
    disabled?: boolean;
    loading?: boolean;
    indeterminate?: boolean;
    beforeCheck?: (state: boolean) => boolean | Promise<boolean>;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueSwitch

```typescript
type NueSwitchSize = 'small' | 'normal' | 'large';

interface NueSwitchProps {
    modelValue?: boolean;
    size?: NueSwitchSize;
    disabled?: boolean;
    loading?: boolean;
    loadingIcon?: string;
    showText?: boolean;
    activeText?: string;
    inactiveText?: string;
    beforeSwitch?: (value: boolean) => Promise<boolean>;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueBadge

```typescript
interface NueBadgeProps {
    value?: string | number;
    max?: number;
    hidden?: boolean;
    dot?: boolean;
    clamped?: number;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueAvatar

```typescript
interface NueAvatarProps {
    src?: string;
    icon?: string;
    size?: string;
    title?: string;
    fit?: 'fill' | 'cover' | 'contain' | 'none' | 'scale-down';
    rounded?: boolean;
    alt?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueProgress

```typescript
type NueProgressType = 'line' | 'circle' | 'dashboard';
type NueProgressColor = string | string[];

interface NueProgressProps {
    type?: NueProgressType;
    color?: NueProgressColor;
    strokeWidth?: number;
    percentage?: number;
    showInnerText?: boolean;
    hideText?: boolean;
    scale?: number;
    formatter?: (p: string) => void | string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueCollapse

```typescript
interface NueCollapseProps {
    modelValue?: string[];
    accordion?: boolean;
    theme?: string | string[] | Record<string, boolean>;
}

interface NueCollapseItemProps {
    title?: string;
    name?: string;
    minHeight?: string;
    maxHeight?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueContainer

```typescript
interface NueContainerProps {
    height?: string;
    width?: string;
    theme?: string | string[] | Record<string, boolean>;
}

interface NueHeaderProps {
    width?: string;
    height?: string;
    theme?: string | string[] | Record<string, boolean>;
}

interface NueMainProps {
    responsive?: boolean;
    theme?: string | string[] | Record<string, boolean>;
}

interface NueAsideProps {
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    collapsedWidth?: string;
    theme?: string | string[] | Record<string, boolean>;
}

interface NueFooterProps {
    width?: string;
    height?: string;
    theme?: string | string[] | Record<string, boolean>;
}

interface NueSeparatorProps {
    opTarget?: 'previous' | 'next' | HTMLElement;
    disabled?: boolean;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueDivider

```typescript
interface NueDividerProps {
    vertical?: boolean;
    alignment?: 'start' | 'center' | 'end';
    lineWidth?: string;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    lineColor?: string;
    text?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueDiv

```typescript
interface NueDivProps {
    direction?: string;
    vertical?: boolean;
    align?: string;
    justify?: string;
    flex?: string;
    wrap?: string;
    gap?: string;
    width?: string;
    height?: string;
    divider?: string | number | boolean | object;
    inline?: boolean;
    overflow?: string;
    autoFit?: boolean;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueText

```typescript
type NueTextTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'span' | 'p' | 'strong' | string;
type NueTextWeight = 'normal' | 'bold' | 'bolder' | 'lighter' | number;
type NueTextAlign = 'left' | 'center' | 'right';
type NueTextDecoration = 'none' | 'underline' | 'line-through' | 'overline';

interface NueTextProps {
    tag?: NueTextTag;
    size?: string;
    color?: string;
    decoration?: NueTextDecoration;
    weight?: NueTextWeight;
    align?: NueTextAlign;
    clamped?: number;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueIcon

```typescript
interface NueIconProps {
    name?: string;
    size?: string;
    color?: string;
    spin?: boolean;
    spinSpeed?: string;
    theme?: string | string[];
}
```

### NueBreadcrumb

```typescript
interface NueBreadcrumbProps {
    separator?: string;
    theme?: string | string[] | Record<string, boolean>;
}

interface NueBreadcrumbItemProps {
    separator?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueMarquee

```typescript
interface NueMarqueeProps {
    infinite?: boolean;
    speedRatio?: number;
    direction?: 'left' | 'right';
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueEmpty

```typescript
interface NueEmptyProps {
    imageSrc?: string;
    imageSize?: string;
    description?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueInfiniteScroll

```typescript
interface NueInfiniteScrollProps {
    triggerHeight?: string;
    height?: string;
    disabled?: boolean;
    loading?: boolean;
    root?: Element | Document | null | 'wrapper';
    rootMargin?: string;
    threshold?: number | number[];
    theme?: string | string[] | Record<string, boolean>;
}
```

### NueLink

```typescript
interface NueLinkProps {
    href?: string;
    disabled?: boolean;
    icon?: string;
    route?: Record<string, unknown> | string;
    flex?: string;
    align?: string;
    size?: string;
    title?: string;
    theme?: string | string[] | Record<string, boolean>;
}
```

## 全局属性

所有组件都继承自 `GlobalProps`:

```typescript
interface GlobalProps {
    theme?: string | string[] | Record<string, boolean>;
}
```

## 主题定制

通过 `theme` 属性可以自定义组件样式:

```vue
<NueButton theme="primary">Primary</NueButton>
<NueButton :theme="['primary', 'rounded']">Rounded Primary</NueButton>
<NueButton :theme="{ primary: true, rounded: false }">Object Theme</NueButton>
```

## 常用图标

NueUI 使用 Iconfont 图标库，可通过 `icon` 属性设置图标:

```
loading, search, bell, calendar, check, close, star, heart, home,
user, settings, edit, delete, download, upload, zoom-in, zoom-out,
arrow-up, arrow-down, arrow-left, arrow-right, chevron-up, chevron-down,
chevron-left, chevron-right, plus, minus, more, menu, filter, sort,
info, warning, error, success, question
```
