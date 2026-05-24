# CSS Design Tokens

All `--nue-*` CSS custom properties defined in `packages/themes/shadlike/src/global/variables.css`.

## Color Palettes

Each palette has 11 steps (0–1000 for primary, 0–100 for semantic colors).

| Palette                 | Hue         | Steps                  | Usage                      |
| ----------------------- | ----------- | ---------------------- | -------------------------- |
| `--nue-primary-color-*` | 0 (gray)    | 0, 100, 200, ..., 1000 | Backgrounds, borders, text |
| `--nue-success-color-*` | 120 (green) | 0, 10, 20, ..., 100    | Success states             |
| `--nue-warning-color-*` | 30 (orange) | 0, 10, 20, ..., 100    | Warning states             |
| `--nue-error-color-*`   | 10 (red)    | 0, 10, 20, ..., 100    | Error states               |

## Semantic Aliases

| Variable                     | Purpose                         |
| ---------------------------- | ------------------------------- |
| `--nue-link-color`           | Link text color                 |
| `--nue-divider-color`        | Divider/border color            |
| `--nue-border-color`         | Alias for `--nue-divider-color` |
| `--nue-disabled-color`       | Disabled state color            |
| `--nue-primary-text-color`   | Primary text color              |
| `--nue-secondary-text-color` | Secondary text color            |

## Shadows

| Variable                 | Value                                           |
| ------------------------ | ----------------------------------------------- |
| `--nue-primary-shadow`   | `1px 1px 2px var(--nue-primary-shadow-color)`   |
| `--nue-secondary-shadow` | `1px 1px 2px var(--nue-secondary-shadow-color)` |

## Typography

| Variable                    | Value                       |
| --------------------------- | --------------------------- |
| `--nue-primary-font-family` | System + Chinese font stack |
| `--nue-primary-font-size`   | `1rem` (base 16px)          |

Text size scale (relative to `--nue-text-df` = `1rem`):

| Variable         | Factor | ~Size    |
| ---------------- | ------ | -------- |
| `--nue-text-2xs` | x0.625 | 0.625rem |
| `--nue-text-xs`  | x0.75  | 0.75rem  |
| `--nue-text-sm`  | x0.875 | 0.875rem |
| `--nue-text-df`  | x1     | 1rem     |
| `--nue-text-md`  | x1.125 | 1.125rem |
| `--nue-text-lg`  | x1.25  | 1.25rem  |
| `--nue-text-xl`  | x1.375 | 1.375rem |
| `--nue-text-2xl` | x1.5   | 1.5rem   |
| `--nue-text-3xl` | x1.75  | 1.75rem  |

## Spacing — Gaps

| Variable        | Value   | Variable       | Value   |
| --------------- | ------- | -------------- | ------- |
| `--nue-gap-2xs` | 0.25rem | `--nue-gap-df` | 1rem    |
| `--nue-gap-xs`  | 0.5rem  | `--nue-gap-md` | 1.25rem |
| `--nue-gap-sm`  | 0.75rem | `--nue-gap-lg` | 1.5rem  |

## Spacing — Padding

| Variable            | Value   | Variable           | Value   |
| ------------------- | ------- | ------------------ | ------- |
| `--nue-padding-2xs` | 0.25rem | `--nue-padding-df` | 1rem    |
| `--nue-padding-xs`  | 0.5rem  | `--nue-padding-md` | 1.25rem |
| `--nue-padding-sm`  | 0.75rem | `--nue-padding-lg` | 1.5rem  |

## Border Radius

| Variable               | Value    |
| ---------------------- | -------- |
| `--nue-primary-radius` | 0.375rem |
| `--nue-radius-sm`      | 0.25rem  |
| `--nue-radius-df`      | 0.375rem |
| `--nue-radius-lg`      | 0.5rem   |

## Box Sizes (form controls, buttons)

| Variable             | Value   | Variable            | Value   |
| -------------------- | ------- | ------------------- | ------- |
| `--nue-box-size-2xs` | 1.5rem  | `--nue-box-size-df` | 2.25rem |
| `--nue-box-size-xs`  | 1.75rem | `--nue-box-size-md` | 2.5rem  |
| `--nue-box-size-sm`  | 2rem    | `--nue-box-size-lg` | 2.75rem |

## Animation

| Variable                          | Value       |
| --------------------------------- | ----------- |
| `--nue-animation-duration-xshort` | 0.06s       |
| `--nue-animation-duration-short`  | 0.18s       |
| `--nue-animation-duration`        | 0.36s       |
| `--nue-animation-duration-long`   | 0.54s       |
| `--nue-animation-timing-function` | ease-in-out |

## Dark Mode

Controlled by a single switch: `--nue-dark-switch: 0` (light) or `1` (dark). All HSL lightness/saturation steps auto-invert via CSS `calc()`. No media queries or class swapping needed.
