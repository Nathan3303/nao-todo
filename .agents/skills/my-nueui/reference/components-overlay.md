# Overlay, Navigation & Action Components

## NueDialog

Modal dialog with header/content/footer layout.

| Prop       | Type      | Default | Description              |
| ---------- | --------- | ------- | ------------------------ |
| modelValue | `boolean` | -       | Visible (v-model)        |
| title      | `string`  | -       | Dialog title             |
| teleportTo | `string`  | -       | Teleport target selector |

**Emits**: `update:modelValue(boolean)`, `confirm()`, `beforeOpen()`, `afterOpen()`, `beforeClose()`, `afterClose()`

**Slots**: `default`, `content` (scoped `{ close }`), `header` (scoped `{ close }`), `footer` (scoped `{ close }`), `reset` (scoped `{ close }` — replaces all default structure)

**Exposed**: `open()`, `close()`

```vue
<NueDialog v-model="visible" title="Confirm" @confirm="handleConfirm">
  <p>Are you sure you want to proceed?</p>
  <template #footer="{ close }">
    <NueButton @click="close">Cancel</NueButton>
    <NueButton theme="primary" @click="handleConfirm">OK</NueButton>
  </template>
</NueDialog>
```

## NueDrawer

Slide-in panel from screen edges.

| Prop                | Type                                     | Default   | Description               |
| ------------------- | ---------------------------------------- | --------- | ------------------------- |
| modelValue          | `boolean`                                | -         | Visible (v-model)         |
| title               | `string`                                 | -         | Drawer title              |
| openFrom            | `'left' \| 'right' \| 'top' \| 'bottom'` | `'right'` | Entry direction           |
| span                | `string`                                 | `'36%'`   | Width/height              |
| minSpan             | `string`                                 | `'240px'` | Minimum dimension         |
| allowCloseByOverlay | `boolean`                                | `false`   | Close by clicking overlay |
| teleportTo          | `string`                                 | -         | Teleport target           |
| onClose             | `(done: () => void) => unknown`          | -         | Custom close guard        |

**Emits**: `update:modelValue(boolean)`, `beforeOpen()`, `afterOpen()`, `beforeClose()`, `afterClose()`

**Slots**: `default` (scoped `{ close }`), `header` (scoped `{ close }`), `footer` (scoped `{ close }`)

**Exposed**: `open()`, `close()`

```vue
<NueDrawer v-model="open" title="Settings" openFrom="right" :span="'400px'" allowCloseByOverlay>
  <NueInput v-model="setting1" placeholder="Setting 1" />
  <NueInput v-model="setting2" placeholder="Setting 2" />
</NueDrawer>
```

## NueTooltip

| Prop         | Type                             | Default         | Description         |
| ------------ | -------------------------------- | --------------- | ------------------- |
| content      | `string`                         | `'No content.'` | Tooltip text        |
| placement    | `string`                         | `'top-center'`  | Popper placement    |
| size         | `'small' \| 'normal' \| 'large'` | -               | Tooltip size        |
| showTriangle | `boolean`                        | -               | Show triangle arrow |

**Slots**: `default` (trigger element), `content` (custom tooltip content)

```vue
<NueTooltip content="Click to save" placement="top-center">
  <NueButton icon="save" theme="icon" />
</NueTooltip>
```

## NueDropdown + NueDropdownItem

**NueDropdown**:

| Prop                         | Type                 | Default          | Description               |
| ---------------------------- | -------------------- | ---------------- | ------------------------- |
| text                         | `string`             | -                | Trigger button text       |
| triggerText                  | `string`             | -                | Alternative trigger text  |
| disabled                     | `boolean`            | -                | Disable dropdown          |
| triggerType                  | `'click' \| 'hover'` | `'click'`        | How to open               |
| size                         | `'small' \| 'large'` | -                | Dropdown size             |
| placement                    | `string`             | `'bottom-start'` | Popper placement          |
| transparent                  | `boolean`            | -                | Transparent overlay       |
| teleportTo                   | `string`             | -                | Teleport target selector  |
| closeWhenExecuted            | `boolean`            | -                | Close after item executed |
| group                        | `string`             | -                | Coordinated group ID      |
| beforeExecute / afterExecute | `() => void`         | -                | Item execution hooks      |

**Emits**: `execute(value: string)`, `open()`, `close()`, `beforeOpen()`, `afterOpen()`, `beforeClose()`, `afterClose()`

**Slots**: `default` (items), `trigger` (scoped: `{ trigger, visible }`)

**NueDropdownItem**:

| Prop              | Type                 | Default | Description                   |
| ----------------- | -------------------- | ------- | ----------------------------- |
| text              | `string`             | -       | Item label                    |
| disabled          | `boolean`            | -       | Disabled                      |
| executeId         | `string`             | -       | Identifier emitted on execute |
| size              | `'small' \| 'large'` | -       | Size                          |
| icon              | `string`             | -       | Leading icon                  |
| loading           | `boolean`            | -       | Loading state                 |
| loadingIcon       | `string`             | -       | Icon when loading             |
| closeWhenExecuted | `boolean`            | `false` | Close parent on execute       |
| useSuffixIcon     | `boolean`            | -       | Show suffix arrow             |

**Slots**: `default`, `append`

```vue
<NueDropdown text="Actions" placement="bottom-start" @execute="handleAction">
  <NueDropdownItem text="Edit" icon="edit" executeId="edit" />
  <NueDropdownItem text="Delete" icon="trash" executeId="delete" theme="danger" />
  <NueDropdownItem text="Disabled" disabled />
</NueDropdown>
```

## NueBreadcrumb + NueBreadcrumbItem

**NueBreadcrumb**:

| Prop      | Type     | Default         | Description         |
| --------- | -------- | --------------- | ------------------- |
| separator | `string` | `'arrow-right'` | Separator icon name |

**NueBreadcrumbItem**:

| Prop      | Type     | Default         | Description               |
| --------- | -------- | --------------- | ------------------------- |
| separator | `string` | `'arrow-right'` | Override parent separator |

**Slots on item**: `default` (label), `separator` (custom separator)

```vue
<NueBreadcrumb separator="chevron-right">
  <NueBreadcrumbItem>Home</NueBreadcrumbItem>
  <NueBreadcrumbItem>Products</NueBreadcrumbItem>
  <NueBreadcrumbItem>Detail</NueBreadcrumbItem>
</NueBreadcrumb>
```

## NueButton

| Prop             | Type                              | Default     | Description                                            |
| ---------------- | --------------------------------- | ----------- | ------------------------------------------------------ |
| icon             | `string`                          | -           | Leading icon name                                      |
| disabled         | `boolean`                         | -           | Disabled                                               |
| loading          | `boolean`                         | -           | Show loading state                                     |
| loadingIcon      | `string`                          | `'loading'` | Icon when loading                                      |
| size             | `'small' \| 'large'`              | -           | Size                                                   |
| flat             | `boolean`                         | -           | Remove border/shadow                                   |
| alignment        | `'start' \| 'center' \| 'end'`    | -           | Content alignment                                      |
| flex             | `string`                          | -           | CSS flex value                                         |
| type             | `'submit' \| 'reset' \| 'button'` | `'button'`  | Native button type                                     |
| title            | `string`                          | -           | Native title                                           |
| useThrottle      | `boolean`                         | `false`     | Throttle click events                                  |
| throttleDuration | `number`                          | `200`       | Throttle delay in ms                                   |
| theme            | same as GlobalProps               | -           | Theme (primary, success, warning, danger, ghost, icon) |

**Emits**: `click(MouseEvent)`
**Slots**: `default` (label), `prepend`, `append`

```vue
<NueButton theme="primary" icon="plus" @click="create">Create</NueButton>
<NueButton theme="danger" loading>Deleting...</NueButton>
<NueButton theme="icon" icon="settings" flat />
<NueButton :useThrottle="true" :throttleDuration="500" @click="submit">
  Submit
  <template #append><NueIcon name="arrow-right" /></template>
</NueButton>
```

## NueButtonGroup

| Prop     | Type                 | Description              |
| -------- | -------------------- | ------------------------ |
| size     | `'small' \| 'large'` | Shared size for children |
| disabled | `boolean`            | Shared disabled state    |

```vue
<NueButtonGroup size="small">
  <NueButton>Left</NueButton>
  <NueButton theme="primary">Middle</NueButton>
  <NueButton>Right</NueButton>
</NueButtonGroup>
```
