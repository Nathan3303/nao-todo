# Theme Packages

NueUI's visual layer is split into two independent packages. This document covers installation, import strategies, and customization for both.

## Package Overview

```
nue-ui (required)          — Vue components, no CSS
    ├── nue-ui-theme-shadlike (strongly recommended) — Visual design system
    └── nue-ui-iconfont (required for icons)         — Icon font + glyphs
```

- `nue-ui` emits BEM classes like `.nue-button--primary` — the shadlike theme provides the CSS rules
- `NueIcon` renders `<i class="iconfont icon-<name>">` — the iconfont package provides `@font-face` and glyph definitions
- Both theme packages are independent: use either, both, or replace with your own

---

## nue-ui-theme-shadlike

A complete CSS design system inspired by shadcn/ui patterns. Pure CSS — no JavaScript, no Vue components.

### Installation

```bash
pnpm install nue-ui-theme-shadlike
```

### Import Strategies

**Full import (recommended for most projects):**

```ts
// main.ts
import 'nue-ui-theme-shadlike/dist/index.css';
```

This gives you: CSS reset, scrollbar styles, animations, all component styles, and all design tokens (~30 component CSS files bundled).

**Global-only (use your own component styles):**

```ts
import 'nue-ui-theme-shadlike/dist/global/index.css';
```

Provides: CSS reset, scrollbar, animations, and all `--nue-*` CSS variables. Component classes will have no visual styling — you provide that yourself.

**Per-component (tree-shake for production):**

```ts
import 'nue-ui-theme-shadlike/dist/global/index.css'; // Always needed for tokens
import 'nue-ui-theme-shadlike/dist/components/button.css';
import 'nue-ui-theme-shadlike/dist/components/input.css';
import 'nue-ui-theme-shadlike/dist/components/dialog.css';
```

Only import the component CSS files you actually use. The full list of available component CSS files: `avatar`, `badge`, `breadcrumb`, `button`, `button-group`, `checkbox`, `collapse`, `confirm`, `container`, `date-picker`, `dialog`, `div`, `divider`, `drawer`, `dropdown`, `empty`, `icon`, `infinite-scroll`, `input`, `link`, `marquee`, `message`, `overlay`, `popup-pool`, `progress`, `prompt`, `select`, `switch`, `text`, `textarea`, `tooltip`.

### Dark Mode

The entire theme is controlled by a single CSS variable:

```css
--nue-dark-switch: 0; /* Light mode (default) */
--nue-dark-switch: 1; /* Dark mode */
```

**Toggle in JavaScript:**

```js
// Enable dark mode
document.documentElement.style.setProperty('--nue-dark-switch', '1');

// Enable light mode
document.documentElement.style.setProperty('--nue-dark-switch', '0');

// Detect current mode
const isDark =
    getComputedStyle(document.documentElement).getPropertyValue('--nue-dark-switch').trim() === '1';
```

**Toggle in CSS (e.g., with a class):**

```css
html.dark {
    --nue-dark-switch: 1;
}
```

**How it works:** All color variables use HSL with dynamic saturation and lightness driven by `--nue-dark-switch` via `calc()`. When the switch flips, every color in the UI inverts automatically — no separate dark theme file, no media queries, no class swapping on individual elements.

### Customization

Override any CSS variable **after** importing the theme:

```css
/* In your global CSS, after the theme import */
:root {
    /* Brand color — change the hue to shift the entire gray palette */
    --nue-brand-hue: 210; /* 0=gray(default), 210=blue, 280=purple */

    /* Semantic color hues */
    --nue-success-hue: 140; /* Green hue (default: 120) */
    --nue-warning-hue: 35; /* Orange hue (default: 30) */
    --nue-error-hue: 0; /* Red hue (default: 10) */

    /* Typography */
    --nue-primary-font-family: 'Inter', -apple-system, sans-serif;
    --nue-primary-font-size-base: 16px;

    /* Spacing */
    --nue-primary-radius: 0.5rem; /* Border radius (default: 0.375rem) */
    --nue-gap-df: 1rem; /* Default gap (default: 1rem) */
    --nue-padding-df: 1rem; /* Default padding (default: 1rem) */

    /* Shadows */
    --nue-primary-shadow-color: hsla(0, 0%, 0%, 0.1);
    --nue-secondary-shadow-color: hsla(0, 0%, 0%, 0.06);
}
```

For the full list of available CSS variables, see [css-tokens.md](css-tokens.md).

### Animations

The theme includes keyframe animations available as CSS classes:

- `.nue-slide-down`, `.nue-slide-up`, `.nue-slide-left`, `.nue-slide-right`
- `.nue-fade-in`, `.nue-fade-out`
- `.nue-move-left`, `.nue-move-right`, `.nue-move-up`, `.nue-move-down`
- `.nue-spin`

Animation durations and easing use variables: `--nue-animation-duration-xshort` (0.06s), `--nue-animation-duration-short` (0.18s), `--nue-animation-duration` (0.36s), `--nue-animation-duration-long` (0.54s), `--nue-animation-timing-function` (ease-in-out).

---

## nue-ui-iconfont

An icon font providing 80+ SVG glyphs as a web font. Required for the `NueIcon` component to render anything visible.

### Installation

```bash
pnpm install nue-ui-iconfont
```

### Import

```ts
// main.ts — import once, available everywhere
import 'nue-ui-iconfont/dist/iconfont.css';
```

The CSS file contains:

1. A `@font-face` declaration defining the `iconfont` font family (loading `.woff2`, `.woff`, `.ttf` fallbacks)
2. CSS rules mapping each icon name to a Unicode private-use-area character via `::before`

### Usage

The `NueIcon` component handles the class names automatically:

```vue
<NueIcon name="search" />
<!-- renders: <i class="iconfont icon-search"></i> -->
<NueIcon name="user" />
<!-- renders: <i class="iconfont icon-user"></i> -->
```

The pattern is always `class="iconfont icon-<name>"`. `iconfont` sets the font family; `icon-<name>` sets the glyph via `::before { content: '\...' }`.

### Raw HTML Usage (without NueIcon)

If you need icons in plain HTML without the Vue component:

```html
<i class="iconfont icon-search"></i>
<i class="iconfont icon-check"></i>
<i class="iconfont icon-loading"></i>
```

### Icon Categories

For the complete list of 80+ icons, see [icon-names.md](icon-names.md). Quick reference by category:

| Category   | Examples                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation | `arrow-left`, `arrow-right`, `arrow-up`, `arrow-down`, `arrow-left-circle`, `arrow-right-circle`                                                                          |
| Actions    | `plus`, `plus-circle`, `minus`, `close`, `clear`, `check`, `square-check`, `edit`, `delete`, `search`, `filter`, `refresh`, `sync-filled`, `update`, `download`, `upload` |
| Status     | `success`, `success-fill`, `error-fill`, `warning`, `fail`, `loading`, `in-progress`, `completed`                                                                         |
| Functions  | `setting`, `settings-fill`, `help`, `theme`, `menu`, `menu-open`, `menu-close`, `more`                                                                                    |
| User       | `user`, `account`, `lock`, `eye`, `eye-close`                                                                                                                             |
| Files      | `files`, `inbox`, `inbox-fill`, `archive`, `recycle-bin`, `restore-bin`, `drive`                                                                                          |
| Time       | `calendar`, `calendar-wrap`, `time`, `history`                                                                                                                            |
| Projects   | `projects`, `board`, `kanban`, `todo`, `invoices`, `connection`                                                                                                           |
| Priority   | `priority-1`, `priority-2`, `priority-3`                                                                                                                                  |
| Other      | `logo`, `mail`, `scan`, `tag`, `share`, `chat`, `picture`, `location`, `list`, `table`, `select`, `coffee`, `heart`, `heart-fill`, `circle`, `ring`, `blank`              |

---

## Relationship Summary

```
User's main.ts
    │
    ├── import 'nue-ui-iconfont/dist/iconfont.css'     ← @font-face + glyph classes
    ├── import 'nue-ui-theme-shadlike/dist/index.css'   ← CSS reset + tokens + component styles
    │
    ├── import NueUI from 'nue-ui'                      ← Vue plugin (all Nue* components)
    ├── app.use(NueUI)                                  ← registers <nue-*> globally
    │
    └── Result: Components render with styles and icons work
```

If you skip `nue-ui-theme-shadlike`: Components render as bare HTML with no visual styling. You must provide all CSS yourself.

If you skip `nue-ui-iconfont`: `NueIcon` components render empty/blank. Other components are unaffected.
