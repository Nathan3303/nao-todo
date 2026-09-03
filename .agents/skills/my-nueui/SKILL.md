---
name: my-nueui
description: >-
    Build Vue 3 business components and pages with the NueUI component library.
    Use whenever the user needs to create Vue components, forms, page layouts,
    dialogs, drawers, data lists, dashboards, or any UI built with NueUI. Trigger
    when the user mentions Vue components, UI layout, form building, admin panels,
    or wants to compose NueUI components together. Covers all ~30+ NueUI
    components with progressive building guidance from single buttons to complete
    business pages. Includes theming, dark mode, iconfont, and design token usage.
---

# NueUI Skill

Vue 3 component library (32 components). All components use the `Nue` prefix and are globally registered via `app.use(NueUI)`.

## Package Ecosystem

NueUI consists of three independent npm packages. Understanding their relationship is essential before generating any code.

| Package                 | Required?                       | Purpose                                                                                                                                                                  |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nue-ui`                | **Required**                    | Vue component library — all `Nue*` components and the plugin installer. Contains NO CSS.                                                                                 |
| `nue-ui-theme-shadlike` | **Strongly recommended**        | Complete CSS design system — component styles, CSS reset, scrollbar, animations, dark mode, and all design tokens. Without it, components render with no styling.        |
| `nue-ui-iconfont`       | **Required if using `NueIcon`** | Icon font file (`.woff2`) and CSS glyph definitions. The `NueIcon` component renders `class="iconfont icon-<name>"` — the font family and glyphs come from this package. |

**Key relationships:**

- `nue-ui` emits BEM-style CSS classes (e.g., `.nue-button--primary`) — the shadlike theme provides the actual CSS rules for those classes.
- `NueIcon` always outputs `class="iconfont icon-<name>"` — without the iconfont CSS loaded, icons will display as blank/fallback text.
- The two theme packages are independent of each other. You can use shadlike without iconfont, or iconfont with a custom theme.

For full theme package details (import paths, dark mode API, customization): [theme-packages.md](reference/theme-packages.md)

## Quick Start

```bash
pnpm install nue-ui nue-ui-theme-shadlike nue-ui-iconfont
```

```ts
// main.ts
import { createApp } from 'vue'
import NueUI from 'nue-ui'
import 'nue-ui-iconfont/dist/iconfont.css' // Icons (required for NueIcon)
import 'nue-ui-theme-shadlike/dist/index.css' // Theme (strongly recommended)
// Or per-component: import 'nue-ui-theme-shadlike/dist/components/button.css';

const app = createApp(App)
app.use(NueUI) // Registers all 32 components globally as <nue-*>
app.mount('#app')
```

After `app.use(NueUI)`, all components are available in templates as `<nue-*>` — no manual imports needed.

**Dark mode toggle:**

```js
// Switch to dark mode
document.documentElement.style.setProperty('--nue-dark-switch', '1')
// Switch to light mode
document.documentElement.style.setProperty('--nue-dark-switch', '0')
```

## Theming System

### Theme Prop

Every component (except `NueIcon`) accepts a `theme` prop with three forms:

| Form   | Example                                     | Result                            |
| ------ | ------------------------------------------- | --------------------------------- |
| String | `theme="primary"`                           | Adds class `nue-button--primary`  |
| Array  | `:theme="['primary', 'large']"`             | Adds both modifier classes        |
| Object | `:theme="{ primary: true, danger: false }"` | Only truthy keys become modifiers |

Common theme variants: `primary`, `success`, `warning`, `danger`, `ghost`, `icon`, `info`, `error`, `secondary`, `text`, `placeholder`, `pure`.

### Dark Mode

The shadlike theme uses a single CSS variable `--nue-dark-switch` (`0` = light, `1` = dark) to invert all colors via HSL `calc()`. All `--nue-*` color variables auto-adapt — no separate dark CSS file needed.

**When writing custom styles, always use `--nue-*` CSS variables instead of hardcoded colors.** Hardcoded values like `#fff` or `#333` will NOT adapt to dark mode.

### Theme Customization

Override CSS variables after importing the theme to customize the look:

```css
:root {
    --nue-brand-hue: 210; /* Change primary hue from gray (0) to blue (210) */
    --nue-primary-radius: 0.5rem; /* Larger border radius */
    --nue-primary-font-family: 'Inter', sans-serif;
}
```

### Icon Font Convention

The `NueIcon` component uses the iconfont package. Icon names follow the pattern `icon-<name>`:

```vue
<NueIcon name="search" />
<!-- renders: <i class="iconfont icon-search"></i> -->
<NueIcon name="loading" spin />
<!-- adds spin animation -->
<NueIcon name="user" size="20px" color="var(--nue-primary-text-color)" />
```

Complete icon list: [icon-names.md](reference/icon-names.md)

### Size Convention

Components with `size` use `'small' | 'large'` (some add `'normal'`). Inside a group parent (`ButtonGroup`, `CheckboxGroup`, `Collapse`, `Select`), children inherit size via `provide/inject`.

## Progressive Building Levels

Use these levels to determine the complexity of your output. Match the user's request to the appropriate level — don't over-engineer simple requests, don't under-deliver on complex ones.

### Level 0: Single Component

**When:** User asks for one specific UI element (button, badge, avatar, icon, text).

**Rules:**

- Output a single `<nue-*>` tag with the correct props
- Always include an appropriate `theme` prop — never leave it default unless it's semantically correct
- For text, use `<nue-text>` instead of raw `<span>`/`<p>`

**Example — "A danger button with a trash icon":**

```vue
<NueButton theme="danger" icon="delete" @click="handleDelete">Delete</NueButton>
```

### Level 1: Simple Composition (2–3 Components)

**When:** User asks for a small UI fragment combining 2–3 elements (search bar, icon+label, badge+avatar).

**Rules:**

- Wrap in `<nue-div>` for flex layout — use `gap`, `align`, `vertical` props, never raw CSS for layout
- Icons always use `<nue-icon>`, never raw `<i>` or emoji
- Spacing via `gap` prop on `NueDiv`, not manual margins

**Example — "A search bar with icon and button":**

```vue
<NueDiv gap="8px" align="center">
  <NueInput v-model="query" placeholder="Search..." icon="search" clearable />
  <NueButton theme="primary" icon="search" @click="search">Search</NueButton>
</NueDiv>
```

### Level 2: Form Building

**When:** User asks for a form, login, registration, settings panel, or filter form.

**Rules:**

- Every form input must have `v-model` for two-way binding
- Use the right input type: `NueInput` for text/password/email, `NueSelect` for choices, `NueSwitch` for toggles, `NueCheckboxGroup` for multi-select, `NueDatePicker` for dates
- Submit button should show `loading` state during async operations
- Use `debounceTime` on search inputs, `useThrottle` on submit buttons for rate limiting
- Handle validation errors inline (red text via `NueText` with theme), not just alerts

**Example — "Login form with remember-me":**

```vue
<template>
    <NueDiv vertical gap="16px" width="320px">
        <NueText tag="h2" size="xl" weight="bold">Sign In</NueText>
        <NueInput v-model="form.username" placeholder="Username" icon="user" clearable />
        <NueInput
            v-model="form.password"
            type="password"
            placeholder="Password"
            allowShowPassword
        />
        <NueCheckbox v-model="form.remember" label="Remember me" />
        <NueButton theme="primary" :loading="loading" :useThrottle="true" @click="handleLogin">
            Sign In
        </NueButton>
    </NueDiv>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'

const form = reactive({ username: '', password: '', remember: false })
const loading = ref(false)

async function handleLogin() {
    loading.value = true
    try {
        await loginApi(form)
    } finally {
        loading.value = false
    }
}
</script>
```

### Level 3: Layout Composition

**When:** User asks for page layouts, admin panels, card grids, or multi-section pages.

**Rules:**

- Use `NueContainer` + `NueHeader` + `NueMain` + `NueFooter` for full-page layouts
- Use `NueAside` for sidebars (fixed or collapsible)
- Use `NueDiv` with `vertical` + `gap` for content sections
- Use `NueSeparator` for resizable split panes (e.g., sidebar | main)
- Use `NueContent` wrapper for padded content areas (`:pure="true"` to remove padding)

**Example — "Admin layout with header, sidebar, and content":**

```vue
<NueContainer height="100vh">
  <NueHeader height="56px" theme="primary">
    <NueDiv align="center" gap="12px">
      <NueText tag="h1" size="lg" weight="bold">Admin Panel</NueText>
    </NueDiv>
  </NueHeader>
  <NueDiv>
    <NueAside width="240px">
      <NueDiv vertical gap="4px" style="padding: var(--nue-padding-df)">
        <NueButton theme="text" icon="home">Dashboard</NueButton>
        <NueButton theme="text" icon="user">Users</NueButton>
        <NueButton theme="text" icon="setting">Settings</NueButton>
      </NueDiv>
    </NueAside>
    <NueMain>
      <NueContent>
        <!-- Page content here -->
      </NueContent>
    </NueMain>
  </NueDiv>
</NueContainer>
```

### Level 4: Overlay Composition

**When:** User asks for modals, drawers, confirmations, tooltips, or dropdown menus.

**Rules:**

- Use `v-model` to control visibility of `NueDialog` and `NueDrawer`
- Use scoped slots `#header`, `#footer`, `#content` (each exposes `{ close }`) for custom content
- For confirmations, prefer the programmatic `NueConfirm()` API over manually wiring a `NueDialog`
- For toast-style feedback, use `NueMessage()` (requires `<NueMessageWrapper />` mounted in App.vue)
- For tooltips, wrap the trigger element in `<NueTooltip>`
- For dropdowns, use `<NueDropdown>` with `<NueDropdownItem>` children — items get `executeId` emitted

**Example — "User edit drawer":**

```vue
<template>
    <NueButton theme="primary" icon="edit" @click="drawerOpen = true">Edit</NueButton>

    <NueDrawer
        v-model="drawerOpen"
        title="Edit User"
        openFrom="right"
        :span="'400px'"
        allowCloseByOverlay
    >
        <NueDiv vertical gap="16px">
            <NueInput v-model="form.name" placeholder="Name" />
            <NueInput v-model="form.email" placeholder="Email" />
            <NueSelect v-model="form.role" placeholder="Role">
                <NueSelectOption label="Admin" value="admin" />
                <NueSelectOption label="User" value="user" />
            </NueSelect>
        </NueDiv>
        <template #footer="{ close }">
            <NueButton @click="close">Cancel</NueButton>
            <NueButton theme="primary" :loading="saving" @click="save">Save</NueButton>
        </template>
    </NueDrawer>
</template>
```

### Level 5: Full Business Components

**When:** User asks for complete features — "a user management page", "a product list", "a dashboard".

**Rules:**

- Compose all previous levels: layout + form/filters + data display + overlays
- Handle ALL states: loading (spinners/skeleton), empty (`NueEmpty`), error (`NueMessage` or inline), disabled
- Use `NueInfiniteScroll` for paginated lists, not manual scroll handlers
- Put `<NueMessageWrapper />` in the root template if using `NueMessage()`
- All custom colors must go through `--nue-*` CSS variables for dark mode compatibility

**Output structure for a full business component:**

1. A main page layout (Level 3)
2. A filter/search toolbar (Level 2)
3. A data list with cards or rows (Level 1 composition repeated)
4. A create/edit drawer or dialog (Level 4)
5. Empty state, loading state, error handling

For concrete recipes, see [recipes.md](reference/recipes.md).

## Composition Rules

When generating business components, follow these rules. They are ordered by priority.

### 1. NueUI First

Always prefer NueUI components over raw HTML equivalents:

| Need            | Use                   | Avoid                          |
| --------------- | --------------------- | ------------------------------ |
| Text            | `<NueText>`           | `<span>`, `<p>`, `<h1>`–`<h5>` |
| Button          | `<NueButton>`         | `<button>`                     |
| Text input      | `<NueInput>`          | `<input>`                      |
| Select/dropdown | `<NueSelect>`         | `<select>`                     |
| Toggle          | `<NueSwitch>`         | Custom checkbox                |
| Multi-select    | `<NueCheckboxGroup>`  | Manual checkbox array          |
| Flex layout     | `<NueDiv>`            | `<div style="display:flex">`   |
| Divider         | `<NueDivider>`        | `<hr>`                         |
| Avatar          | `<NueAvatar>`         | Raw `<img>`                    |
| Badge/count     | `<NueBadge>`          | Manual positioned `<sup>`      |
| Icon            | `<NueIcon>`           | `<i>`, emoji, raw SVG          |
| Empty state     | `<NueEmpty>`          | Centered text div              |
| Modal           | `<NueDialog>`         | Hand-built overlay             |
| Slide-in panel  | `<NueDrawer>`         | Hand-built slide               |
| Tooltip         | `<NueTooltip>`        | Hand-built hover               |
| Collapse        | `<NueCollapse>`       | Hand-built accordion           |
| Progress        | `<NueProgress>`       | Hand-built bar                 |
| Toast           | `NueMessage()`        | `alert()`                      |
| Confirm dialog  | `NueConfirm()`        | Manual `NueDialog` wiring      |
| Prompt dialog   | `NuePrompt()`         | Manual `NueDialog` + input     |
| Infinite scroll | `<NueInfiniteScroll>` | Manual `IntersectionObserver`  |
| Breadcrumb      | `<NueBreadcrumb>`     | Manual link list               |
| Marquee         | `<NueMarquee>`        | Manual CSS animation           |
| Resizable panel | `<NueSeparator>`      | Manual drag handlers           |

**Exception:** Use a raw `<div>` only when you need a pure container with no flex/styling — and even then, consider whether `<NueContent>` or `<NueDiv>` would be better.

### 2. Theme Everything

Every component must carry a semantically appropriate `theme`:

- Primary actions: `theme="primary"`
- Destructive actions: `theme="danger"`
- Icon-only buttons: `theme="icon"`
- Success states: `theme="success"`
- Warning states: `theme="warning"`
- Text-only buttons in nav: `theme="text"`
- Ghost/secondary: `theme="ghost"`

Don't blindly apply `primary` to every button — use semantic themes that communicate intent.

### 3. Use Design Tokens

All custom CSS must use `--nue-*` CSS variables, never hardcoded values:

- Spacing: `var(--nue-gap-df)`, `var(--nue-padding-df)`
- Colors: `var(--nue-primary-color-200)`, `var(--nue-primary-text-color)`
- Borders: `var(--nue-border-color)`, `var(--nue-primary-radius)`
- Animation: `var(--nue-animation-duration)`

**Why:** Hardcoded colors (`#fff`, `#333`) break in dark mode. CSS variables auto-adapt.

### 4. Cover All States

Every business component must account for:

- **Loading** — `loading` prop on buttons, `NueProgress` for page-level, skeleton patterns for lists
- **Empty** — `<NueEmpty>` with a description and optional action button
- **Error** — `NueMessage.error()` for toasts, inline `<NueText color="var(--nue-error-color-50))">` for form errors
- **Disabled** — `disabled` prop on inputs/buttons during processing

### 5. Dark Mode Compatible

Never hardcode colors in `style` blocks or inline styles. Always route through CSS variables:

```css
/* ✅ CORRECT — auto-adapts to dark mode */
background: var(--nue-primary-color-100);
color: var(--nue-primary-text-color);
border: 1px solid var(--nue-border-color);

/* ❌ WRONG — broken in dark mode */
background: #ffffff;
color: #333333;
border: 1px solid #e0e0e0;
```

## Patterns

### v-model

All form components use `v-model`. Group components (`CheckboxGroup`, `Collapse`) use arrays.

```vue
<NueInput v-model="name" />
<NueSwitch v-model="enabled" />
<NueCheckboxGroup v-model="checkedNames"></NueCheckboxGroup>
```

### Compound Components

Always wrap children in their parent. Parents share `size`/`disabled` via `provide/inject`.

```vue
<NueSelect v-model="value">
  <NueSelectOption label="A" :value="1" />
</NueSelect>

<NueButtonGroup size="small">
  <NueButton>Left</NueButton>
  <NueButton>Right</NueButton>
</NueButtonGroup>
```

### Scoped Slots

Dialogs and Drawers expose `close` in `#header`, `#footer`, `#default` slots.

```vue
<NueDialog v-model="visible" title="Dialog">
  <template #footer="{ close }">
    <NueButton @click="close">Cancel</NueButton>
  </template>
</NueDialog>
```

### Async Guards

`beforeCheck` (Checkbox), `beforeSwitch` (Switch) accept `() => Promise<boolean>` to gate actions.

### Throttle / Debounce

`NueButton` has built-in `useThrottle` + `throttleDuration`. `NueInput`/`NueTextarea` have `debounceTime`.

### Teleport

`Dialog`, `Drawer`, `Dropdown` support `teleportTo` for rendering overlays in specific DOM nodes.

## Programmatic APIs

Quick reference. Full details: [programmatic-api.md](reference/programmatic-api.md)

| API                                    | Returns                          | Use for                   |
| -------------------------------------- | -------------------------------- | ------------------------- |
| `NueMessage({ message, type })`        | `void`                           | Toast notifications       |
| `NueMessage.success('msg')`            | `void`                           | Convenience success toast |
| `NueMessage.error('msg')`              | `void`                           | Convenience error toast   |
| `NueConfirm({ title, content, ... })`  | `Promise<[isCancelled, result]>` | Confirmation dialogs      |
| `NuePrompt({ title, validator, ... })` | `Promise<[isCancelled, value]>`  | Input prompt dialogs      |

**Setup:** Mount `<NueMessageWrapper />` once in your root component (e.g., `App.vue`) for `NueMessage()` to work. `<NuePopupPool />` is auto-created on first use.

## Component Catalog

Complete details for each component are in the reference files. This table is a quick lookup — read the linked file when you need full prop/event/slot details.

### Display & Text

| Component | Description                           | Reference                              |
| --------- | ------------------------------------- | -------------------------------------- |
| `NueText` | Styled text with tag/size/color/clamp | [data](reference/components-data.md)   |
| `NueLink` | `<a>` or `<router-link>` with icon    | [data](reference/components-data.md)   |
| `NueIcon` | Icon font glyph by name               | [other](reference/components-other.md) |

### Layout

| Component      | Description                          | Reference                                |
| -------------- | ------------------------------------ | ---------------------------------------- |
| `NueDiv`       | Flexbox container, optional dividers | [layout](reference/components-layout.md) |
| `NueDivider`   | Visual separator with optional label | [layout](reference/components-layout.md) |
| `NueContainer` | Root layout wrapper                  | [layout](reference/components-layout.md) |
| `NueHeader`    | Top bar within Container             | [layout](reference/components-layout.md) |
| `NueFooter`    | Bottom bar within Container          | [layout](reference/components-layout.md) |
| `NueAside`     | Sidebar panel                        | [layout](reference/components-layout.md) |
| `NueMain`      | Main content area                    | [layout](reference/components-layout.md) |
| `NueContent`   | Content wrapper with padding control | [layout](reference/components-layout.md) |
| `NueSeparator` | Draggable resize handle              | [layout](reference/components-layout.md) |

### Actions

| Component        | Description                          | Reference                                  |
| ---------------- | ------------------------------------ | ------------------------------------------ |
| `NueButton`      | Button with loading/throttle/icon    | [overlay](reference/components-overlay.md) |
| `NueButtonGroup` | Groups buttons, shares size/disabled | [overlay](reference/components-overlay.md) |

### Forms

| Component          | Description                      | Reference                            |
| ------------------ | -------------------------------- | ------------------------------------ |
| `NueInput`         | Text/password/number/email input | [form](reference/components-form.md) |
| `NueTextarea`      | Multi-line input, auto-resize    | [form](reference/components-form.md) |
| `NueCheckbox`      | Single checkbox with async guard | [form](reference/components-form.md) |
| `NueCheckboxGroup` | Checkbox group with min/max      | [form](reference/components-form.md) |
| `NueSwitch`        | Toggle switch with async guard   | [form](reference/components-form.md) |
| `NueSelect`        | Dropdown select (parent-child)   | [form](reference/components-form.md) |
| `NueDatePicker`    | Date/datetime picker             | [form](reference/components-form.md) |

### Data Display

| Component     | Description                          | Reference                            |
| ------------- | ------------------------------------ | ------------------------------------ |
| `NueAvatar`   | Image avatar with icon fallback      | [data](reference/components-data.md) |
| `NueBadge`    | Notification badge (value or dot)    | [data](reference/components-data.md) |
| `NueEmpty`    | Empty state placeholder              | [data](reference/components-data.md) |
| `NueProgress` | Progress bar (line/circle/dashboard) | [data](reference/components-data.md) |
| `NueMarquee`  | Scrolling text/content               | [data](reference/components-data.md) |
| `NueCollapse` | Accordion/collapsible panels         | [data](reference/components-data.md) |

### Navigation

| Component       | Description                 | Reference                                  |
| --------------- | --------------------------- | ------------------------------------------ |
| `NueBreadcrumb` | Breadcrumb trail            | [overlay](reference/components-overlay.md) |
| `NueDropdown`   | Dropdown menu (click/hover) | [overlay](reference/components-overlay.md) |

### Overlays

| Component    | Description             | Reference                                  |
| ------------ | ----------------------- | ------------------------------------------ |
| `NueDialog`  | Modal dialog with slots | [overlay](reference/components-overlay.md) |
| `NueDrawer`  | Slide-in panel          | [overlay](reference/components-overlay.md) |
| `NueTooltip` | Hover tooltip           | [overlay](reference/components-overlay.md) |

### Other

| Component           | Description                               | Reference                              |
| ------------------- | ----------------------------------------- | -------------------------------------- |
| `NueInfiniteScroll` | Infinite scroll with IntersectionObserver | [other](reference/components-other.md) |

## Output Format

When asked to generate a business component, always include everything needed to run — including the `main.ts` setup if the user is starting from scratch.

### For a new project / starting from scratch

Include the complete `main.ts` with all three package imports:

```ts
import { createApp } from 'vue'
import NueUI from 'nue-ui'
import 'nue-ui-iconfont/dist/iconfont.css'
import 'nue-ui-theme-shadlike/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(NueUI)
app.mount('#app')
```

### For a business component

Output a complete `.vue` SFC:

```vue
<template>
    <!-- Only <nue-*> tags and necessary semantic HTML -->
</template>

<script lang="ts" setup>
import { ref, reactive, computed } from 'vue'
// NueUI components are globally registered — no imports needed
// For hooks: import { useBoolState, useLoadingState } from '@nue-ui/hooks';
// For programmatic APIs: import { NueMessage, NueConfirm, NuePrompt } from 'nue-ui';
</script>

<style scoped>
/* Custom styles use --nue-* CSS variables exclusively */
</style>
```

After the component, briefly explain:

- Which NueUI components were used and why
- Which CSS packages the component depends on
- How loading, empty, error, and disabled states are handled

## File Navigation

| When you need...                                                                            | Read this                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Theme packages setup, dark mode, iconfont import paths, customization                       | [reference/theme-packages.md](reference/theme-packages.md)         |
| Business component recipes (login form, search bar, data list, etc.)                        | [reference/recipes.md](reference/recipes.md)                       |
| Form component details (Input, Select, Checkbox, Switch, DatePicker)                        | [reference/components-form.md](reference/components-form.md)       |
| Layout component details (Container, Div, Separator, Header, Aside)                         | [reference/components-layout.md](reference/components-layout.md)   |
| Data display details (Avatar, Badge, Collapse, Text, Link, Empty, Progress, Marquee)        | [reference/components-data.md](reference/components-data.md)       |
| Overlay, action, navigation details (Button, Dialog, Drawer, Dropdown, Breadcrumb, Tooltip) | [reference/components-overlay.md](reference/components-overlay.md) |
| Other components (InfiniteScroll, Icon)                                                     | [reference/components-other.md](reference/components-other.md)     |
| NueMessage, NueConfirm, NuePrompt full API                                                  | [reference/programmatic-api.md](reference/programmatic-api.md)     |
| Complete icon name list                                                                     | [reference/icon-names.md](reference/icon-names.md)                 |
| CSS variables / design tokens                                                               | [reference/css-tokens.md](reference/css-tokens.md)                 |
| Sub-package utilities & hooks                                                               | [reference/sub-packages.md](reference/sub-packages.md)             |