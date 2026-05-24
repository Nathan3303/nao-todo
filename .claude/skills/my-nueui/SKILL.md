# NueUI Skill

Vue 3 component library (~30+ components). All components use the `Nue` prefix and are globally registered via `app.use(NueUI)`.

## Quick Start

```ts
import { createApp } from 'vue';
import NueUI from 'nue-ui';
import 'nue-ui/dist/theme/index.css';

const app = createApp(App);
app.use(NueUI);
app.mount('#app');
```

After registration, all components are available as `<nue-*>` in templates. No manual imports needed.

## Theming System

Every component (except NueIcon) accepts a `theme` prop with three forms:

| Form   | Example                                     | Result                            |
| ------ | ------------------------------------------- | --------------------------------- |
| String | `theme="primary"`                           | adds class `nue-button--primary`  |
| Array  | `:theme="['primary', 'large']"`             | adds both modifier classes        |
| Object | `:theme="{ primary: true, danger: false }"` | only truthy keys become modifiers |

Common theme variants: `primary`, `success`, `warning`, `danger`, `ghost`, `icon`, `info`, `error`, `secondary`, `text`, `placeholder`.

## Size Convention

Components with `size` use `'small' | 'large'` (some add `'normal'`). Inside a group parent (ButtonGroup, CheckboxGroup, Collapse, Select), children inherit size via `provide/inject`.

## Component Catalog

| Component         | Category   | Quick description                                     | Details                                    |
| ----------------- | ---------- | ----------------------------------------------------- | ------------------------------------------ |
| NueText           | Display    | Styled text with tag/size/color control               | [data](reference/components-data.md)       |
| NueIcon           | Display    | Renders icon font glyphs by name                      | [other](reference/components-other.md)     |
| NueLink           | Display    | `<a>` or `<router-link>` with icon                    | [data](reference/components-data.md)       |
| NueDiv            | Layout     | Flexbox container, optional dividers between children | [layout](reference/components-layout.md)   |
| NueDivider        | Layout     | Visual separator line with optional label             | [layout](reference/components-layout.md)   |
| NueContainer      | Layout     | Main layout wrapper (header/main/footer slots)        | [layout](reference/components-layout.md)   |
| NueHeader         | Layout     | Top bar within Container                              | [layout](reference/components-layout.md)   |
| NueFooter         | Layout     | Bottom bar within Container                           | [layout](reference/components-layout.md)   |
| NueAside          | Layout     | Sidebar panel                                         | [layout](reference/components-layout.md)   |
| NueMain           | Layout     | Main content area, optional responsive                | [layout](reference/components-layout.md)   |
| NueContent        | Layout     | Content wrapper with padding control                  | [layout](reference/components-layout.md)   |
| NueSeparator      | Layout     | Draggable resize handle between siblings              | [layout](reference/components-layout.md)   |
| NueAvatar         | Data       | Image avatar with icon fallback                       | [data](reference/components-data.md)       |
| NueBadge          | Data       | Notification badge (value or dot)                     | [data](reference/components-data.md)       |
| NueEmpty          | Data       | Empty state placeholder                               | [data](reference/components-data.md)       |
| NueProgress       | Data       | Progress bar (line/circle/dashboard)                  | [data](reference/components-data.md)       |
| NueMarquee        | Data       | Scrolling text/content                                | [data](reference/components-data.md)       |
| NueCollapse       | Data       | Accordion/collapsible panels                          | [data](reference/components-data.md)       |
| NueBreadcrumb     | Navigation | Breadcrumb trail with separator                       | [overlay](reference/components-overlay.md) |
| NueDropdown       | Navigation | Dropdown menu (click or hover), popper-positioned     | [overlay](reference/components-overlay.md) |
| NueButton         | Action     | Button with loading/throttle/icon support             | [overlay](reference/components-overlay.md) |
| NueButtonGroup    | Action     | Groups buttons, shares size/disabled                  | [overlay](reference/components-overlay.md) |
| NueInput          | Form       | Text/password/number/email input, debounce, counter   | [form](reference/components-form.md)       |
| NueTextarea       | Form       | Multi-line input, auto-resize                         | [form](reference/components-form.md)       |
| NueCheckbox       | Form       | Single checkbox with async guard                      | [form](reference/components-form.md)       |
| NueCheckboxGroup  | Form       | Checkbox group with controller/min/max                | [form](reference/components-form.md)       |
| NueSwitch         | Form       | Toggle switch, optional on/off text                   | [form](reference/components-form.md)       |
| NueSelect         | Form       | Dropdown select (parent-child with SelectOption)      | [form](reference/components-form.md)       |
| NueDatePicker     | Form       | Date/datetime picker, ISO string output               | [form](reference/components-form.md)       |
| NueDialog         | Overlay    | Modal dialog with header/content/footer slots         | [overlay](reference/components-overlay.md) |
| NueDrawer         | Overlay    | Slide-in panel from screen edges                      | [overlay](reference/components-overlay.md) |
| NueTooltip        | Overlay    | Hover tooltip, popper-positioned                      | [overlay](reference/components-overlay.md) |
| NueInfiniteScroll | Other      | Infinite scroll with IntersectionObserver             | [other](reference/components-other.md)     |

## Patterns

- **v-model** — All form components use `v-model`. Group components use arrays.
- **Compound components** — Always wrap children in their parent (e.g. `<NueSelectOption>` inside `<NueSelect>`). Parent shares size/disabled via `provide/inject`.
- **Scoped slots** — Dialogs/Drawers expose `close` in `#header`, `#footer`, `#default` slots.
- **Async guards** — `beforeCheck`, `beforeSwitch` accept `() => Promise<boolean>` to gate actions.
- **Throttle/Debounce** — NueButton has built-in `useThrottle`. NueInput/NueTextarea have `debounceTime`.
- **Teleport** — Dialog, Drawer, Dropdown support `teleportTo` for rendering overlays in specific DOM nodes.
- **MessageWrapper** — Mount `<NueMessageWrapper />` once (e.g. App.vue) for `NueMessage()` to work.

## Programmatic APIs (quick reference)

| API                                    | Returns                          | Use for              |
| -------------------------------------- | -------------------------------- | -------------------- |
| `NueMessage({ message, type })`        | `void`                           | Toast notifications  |
| `NueConfirm({ title, content, ... })`  | `Promise<[isCancelled, result]>` | Confirmation dialogs |
| `NuePrompt({ title, validator, ... })` | `Promise<[isCancelled, value]>`  | Input prompt dialogs |

Full details: [programmatic-api.md](reference/programmatic-api.md)

## File Navigation

| When you need...                                           | Read this                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Form component details (Input, Select, Checkbox, etc.)     | [reference/components-form.md](reference/components-form.md)       |
| Layout component details (Container, Div, Separator, etc.) | [reference/components-layout.md](reference/components-layout.md)   |
| Data display details (Avatar, Badge, Collapse, Text, etc.) | [reference/components-data.md](reference/components-data.md)       |
| Overlay/action details (Dialog, Dropdown, Button, etc.)    | [reference/components-overlay.md](reference/components-overlay.md) |
| Other components (InfiniteScroll, Icon)                    | [reference/components-other.md](reference/components-other.md)     |
| NueMessage, NueConfirm, NuePrompt full API                 | [reference/programmatic-api.md](reference/programmatic-api.md)     |
| Complete icon name list                                    | [reference/icon-names.md](reference/icon-names.md)                 |
| CSS variables / design tokens                              | [reference/css-tokens.md](reference/css-tokens.md)                 |
| Sub-package utilities & hooks                              | [reference/sub-packages.md](reference/sub-packages.md)             |
