# Layout Components

## NueDiv

Flexbox container (render function component, no `.vue` template). Inserts dividers between children when `divider` is truthy.

| Prop      | Type                                    | Default | Description                                                         |
| --------- | --------------------------------------- | ------- | ------------------------------------------------------------------- |
| direction | `string`                                | -       | CSS flex-direction                                                  |
| vertical  | `boolean`                               | -       | Shorthand for `direction: column`                                   |
| align     | `string`                                | -       | CSS align-items                                                     |
| justify   | `string`                                | -       | CSS justify-content                                                 |
| flex      | `string`                                | -       | CSS flex                                                            |
| wrap      | `string`                                | -       | CSS flex-wrap                                                       |
| gap       | `string`                                | -       | CSS gap between children                                            |
| width     | `string`                                | -       | CSS width                                                           |
| height    | `string`                                | -       | CSS height                                                          |
| inline    | `boolean`                               | -       | `display: inline-flex`                                              |
| overflow  | `string`                                | -       | CSS overflow                                                        |
| divider   | `string \| number \| boolean \| object` | -       | Insert NueDivider between children (object passed as divider props) |
| theme     | `string \| string[]`                    | -       | Theme                                                               |
| autoFit   | `boolean`                               | -       | Auto-fit behavior                                                   |

```vue
<NueDiv vertical gap="16px" divider>
  <NueText>Item 1</NueText>
  <NueText>Item 2</NueText>
</NueDiv>
```

## NueDivider

Visual divider line with optional label.

| Prop      | Type                              | Default   | Description                  |
| --------- | --------------------------------- | --------- | ---------------------------- |
| vertical  | `boolean`                         | -         | Vertical orientation         |
| alignment | `'start' \| 'center' \| 'end'`    | -         | Label position along divider |
| lineWidth | `string`                          | -         | Border width                 |
| lineStyle | `'solid' \| 'dashed' \| 'dotted'` | `'solid'` | Border style                 |
| lineColor | `string`                          | -         | Border color                 |
| text      | `string`                          | -         | Label text                   |
| theme     | same as GlobalProps               | -         | Theme                        |

**Slots**: `default` (custom label, falls back to `text` prop)

```vue
<NueDivider text="or" alignment="center" />
<NueDivider lineStyle="dashed" lineColor="#eee" />
```

## NueContainer

Main layout wrapper. Slots: `default` (typically Header + Main + Footer).

| Prop   | Type     | Description      |
| ------ | -------- | ---------------- |
| height | `string` | Container height |
| width  | `string` | Container width  |

```vue
<NueContainer height="100vh">
  <NueHeader height="60px">Header</NueHeader>
  <NueMain>Content</NueMain>
  <NueFooter height="40px">Footer</NueFooter>
</NueContainer>
```

## NueHeader, NueFooter

| Prop   | Type     | Description    |
| ------ | -------- | -------------- |
| height | `string` | Element height |
| width  | `string` | Element width  |

## NueAside

| Prop           | Type     | Description          |
| -------------- | -------- | -------------------- |
| width          | `string` | Width                |
| minWidth       | `string` | Min width            |
| maxWidth       | `string` | Max width            |
| collapsedWidth | `string` | Width when collapsed |

## NueMain

| Prop       | Type      | Default | Description                |
| ---------- | --------- | ------- | -------------------------- |
| responsive | `boolean` | -       | Enable responsive behavior |

## NueContent

| Prop | Type      | Default | Description          |
| ---- | --------- | ------- | -------------------- |
| pure | `boolean` | -       | No padding           |
| fill | `boolean` | -       | Fill available space |

## NueSeparator

Draggable resize handle between siblings.

| Prop     | Type                                  | Description             |
| -------- | ------------------------------------- | ----------------------- |
| opTarget | `'previous' \| 'next' \| HTMLElement` | Which sibling to resize |
| disabled | `boolean`                             | Disable dragging        |

**Emits**: `resize(width: number)` — fired during drag
