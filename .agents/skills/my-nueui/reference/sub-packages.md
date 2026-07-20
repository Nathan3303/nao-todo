# Sub-Package Reference

NueUI is a pnpm monorepo. These sub-packages are available for import by page developers.

## @nue-ui/utils

Import: `import { ... } from '@nue-ui/utils'` (or `'nue-ui'` re-exports everything).

### Utility Functions

| Export              | Signature                                        | Use for                                                                     |
| ------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| `generateId`        | `(length?: number) => string`                    | Random alphanumeric ID (default 6 chars). Uses `Math.random().toString(36)` |
| `generateElementId` | `(length?: number) => string`                    | Same but letters only — safe for HTML `id` attributes                       |
| `debounce`          | `<T>(cb: T, delay: number) => (...args) => void` | Delay execution until after `delay` ms of inactivity                        |
| `throttle`          | `<T>(cb: T, delay: number) => (...args) => void` | Limit execution to at most once per `delay` ms                              |
| `isString`          | `(value: unknown) => boolean`                    | Runtime string type check                                                   |
| `isNumber`          | `(value: unknown) => boolean`                    | Runtime number type check                                                   |
| `isArray`           | `(value: unknown) => boolean`                    | Delegates to `Array.isArray`                                                |
| `isFunction`        | `(value: unknown) => boolean`                    | Checks `typeof === 'function'`                                              |

### Parsers

| Export                           | Signature                                                                                        | Use for                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `parseTheme`                     | `(value: string \| string[] \| Record<string,boolean> \| undefined, prefix: string) => string[]` | Convert theme prop to CSS class array. e.g. `parseTheme('dark', 'nue-btn')` → `['nue-btn--dark']` |
| `parseFlex`                      | `(value: string) => string`                                                                      | Normalize flex value (empty → `'auto'`)                                                           |
| `parseFlexWrap`                  | `(value: string) => string`                                                                      | Normalize flex-wrap value (empty → `'wrap'`)                                                      |
| `parseAnimationDurationToNumber` | `(value: string \| number) => number`                                                            | Convert `'0.3s'` to `300` (ms)                                                                    |
| `parsePopupItemAnimation`        | `(value?: string \| { name, duration }) => { name, duration }`                                   | Normalize popup animation config                                                                  |

### Types

```typescript
type ObjectLikeThemes = Record<string, boolean>;

interface GlobalProps {
    theme?: string | string[] | ObjectLikeThemes;
}

type NuePopupItemAnimation = string | { name: string; duration?: number };
```

## @nue-ui/hooks

Import: `import { ... } from '@nue-ui/hooks'`.

### State Hooks

**`useBoolState(initialValue: boolean)`**

Returns `[state, switchState, setState]`:

- `state: Ref<boolean>` — reactive boolean
- `switchState()` — toggle on/off
- `setState(newState: boolean)` — set directly

```ts
const [isOpen, toggleOpen, setOpen] = useBoolState(false);
```

**`useLoadingState(initialValue?: boolean | (() => boolean))`**

Returns `{ isLoading, load, loadSync }` for async operation management.

```ts
const { isLoading, load } = useLoadingState();

load(done => {
    fetchData().finally(done);
});
```

### Layout Hooks

**`useWindowResize()`**

Returns `{ addCallback, removeCallback }`. Callbacks are auto-debounced (100ms) and cleaned up on unmount.

### Popper Hooks (advanced positioning)

**`usePopperV2(wrapperRef, popperRef, gap?)`**

Returns `{ calculatePopperPosition(direction, alignment) }` which returns `{ x, y, direction? }`. Auto-flips on viewport overflow.

**`usePopupAnchor(popupPoolId?)`**

Creates a Teleport anchor element in the popup pool. Returns `{ mountPopupAnchor, unmountPopupAnchor, tpState }`.

### Placement Types

```typescript
type PopperDirection = 'top' | 'bottom' | 'left' | 'right';
type PopperAlignment = 'start' | 'center' | 'end';
type PopperPlacement = `${PopperDirection}-${PopperAlignment}`;
// Examples: 'bottom-start', 'top-center', 'left-end'
```
