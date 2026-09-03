# Data Display Components

## NueText

Renders text with full styling control. Root element is customizable via `tag` prop.

| Prop       | Type                                                     | Default  | Description                                           |
| ---------- | -------------------------------------------------------- | -------- | ----------------------------------------------------- |
| tag        | `'h1'-'h5' \| 'span' \| 'p' \| 'strong' \| string`       | `'span'` | Root HTML tag                                         |
| size       | `'xs' \| 'sm' \| 'df' \| 'md' \| 'lg' \| 'xl' \| string` | -        | Font size (keys = preset rem values) or any CSS value |
| color      | `string`                                                 | -        | Text color                                            |
| decoration | `'none' \| 'underline' \| 'line-through' \| 'overline'`  | -        | Text decoration                                       |
| weight     | `'normal' \| 'bold' \| 'bolder' \| 'lighter' \| number`  | -        | Font weight                                           |
| align      | `'left' \| 'center' \| 'right'`                          | -        | Text alignment                                        |
| clamped    | `number`                                                 | -        | Line clamp limit (CSS -webkit-line-clamp)             |
| theme      | same as GlobalProps                                      | -        | Theme modifiers                                       |

**Slot**: `default` — text content

```vue
<NueText tag="h2" size="xl" weight="bold" clamped="2">
  This text will be clamped after 2 lines.
</NueText>
```

## NueLink

Renders `<a>` or `<router-link>` depending on props.

| Prop     | Type                                | Default | Description                                    |
| -------- | ----------------------------------- | ------- | ---------------------------------------------- |
| href     | `string`                            | -       | URL for `<a>`                                  |
| route    | `Record<string, unknown> \| string` | -       | Vue Router route (switches to `<router-link>`) |
| disabled | `boolean`                           | -       | Disabled state                                 |
| icon     | `string`                            | -       | Leading icon name                              |
| flex     | `string`                            | -       | CSS flex                                       |
| align    | `string`                            | -       | Text alignment                                 |
| size     | `string`                            | -       | Font size                                      |
| title    | `string`                            | -       | Title attribute                                |
| theme    | same as GlobalProps                 | -       | Theme                                          |

**Slots**: `default` (link text, falls back to `href`), `append`

```vue
<NueLink href="https://example.com" icon="link">Visit</NueLink>
<NueLink :route="{ name: 'home' }">Home</NueLink>
```

## NueAvatar

| Prop    | Type                                                       | Default   | Description                 |
| ------- | ---------------------------------------------------------- | --------- | --------------------------- |
| src     | `string`                                                   | -         | Image URL                   |
| icon    | `string`                                                   | -         | Fallback icon name          |
| size    | `string`                                                   | -         | CSS size value              |
| fit     | `'fill' \| 'cover' \| 'contain' \| 'none' \| 'scale-down'` | `'cover'` | Object-fit                  |
| rounded | `boolean`                                                  | -         | Rounded style               |
| alt     | `string`                                                   | -         | Alt text / fallback initial |
| title   | `string`                                                   | -         | Title attribute             |

**Emits**: `error(Event)` — image load failure
**Slot**: `default` — custom fallback content

```vue
<NueAvatar src="/user.jpg" size="48px" rounded alt="Nathan" />
<NueAvatar icon="user" size="32px" />
```

## NueBadge

Wraps an element with a notification badge.

| Prop   | Type               | Default | Description                  |
| ------ | ------------------ | ------- | ---------------------------- |
| value  | `string \| number` | -       | Badge content                |
| max    | `number`           | -       | Clamp value (shows `max+`)   |
| hidden | `boolean`          | -       | Hide badge                   |
| dot    | `boolean`          | -       | Show as dot instead of value |

```vue
<NueBadge :value="99" :max="99">
  <NueButton>Messages</NueButton>
</NueBadge>
<NueBadge dot>
  <NueIcon name="bell" />
</NueBadge>
```

## NueEmpty

Empty state placeholder.

| Prop        | Type     | Default        | Description      |
| ----------- | -------- | -------------- | ---------------- |
| imageSrc    | `string` | (built-in SVG) | Custom image     |
| imageSize   | `string` | `'64px'`       | Image size       |
| description | `string` | -              | Description text |

**Slots**: `default`, `image`, `description`

```vue
<NueEmpty description="No data yet">
  <NueButton theme="primary">Create Now</NueButton>
</NueEmpty>
```

## NueProgress

| Prop          | Type                                | Default     | Description                           |
| ------------- | ----------------------------------- | ----------- | ------------------------------------- |
| type          | `'line' \| 'circle' \| 'dashboard'` | `'line'`    | Progress shape                        |
| color         | `string \| string[]`                | `'#757575'` | Bar color (array = gradient for line) |
| strokeWidth   | `number`                            | `6`         | Stroke width in px                    |
| percentage    | `number`                            | `0`         | Progress value 0-100                  |
| showInnerText | `boolean`                           | -           | Show text inside bar                  |
| hideText      | `boolean`                           | -           | Hide percentage text                  |
| scale         | `number`                            | `1`         | Visual scale                          |
| formatter     | `(p: string) => string`             | identity    | Format percentage text                |

**Emits**: `full()` — when percentage reaches 100

```vue
<NueProgress :percentage="65" color="#4caf50" showInnerText />
<NueProgress type="circle" :percentage="80" :strokeWidth="8" />
<NueProgress type="dashboard" :percentage="30" />
```

## NueMarquee

Scrolling text / content.

| Prop       | Type                | Default  | Description                          |
| ---------- | ------------------- | -------- | ------------------------------------ |
| infinite   | `boolean`           | `false`  | Loop infinitely (duplicates content) |
| speedRatio | `number`            | `1`      | Speed multiplier                     |
| direction  | `'left' \| 'right'` | `'left'` | Scroll direction                     |

```vue
<NueMarquee infinite :speedRatio="0.5">
  Breaking news: This text scrolls continuously
</NueMarquee>
```

## NueCollapse + NueCollapseItem

**NueCollapse** (parent):

| Prop       | Type       | Default | Description                 |
| ---------- | ---------- | ------- | --------------------------- |
| modelValue | `string[]` | -       | Active item names (v-model) |
| accordion  | `boolean`  | -       | Single open item mode       |

**NueCollapseItem** (child):

| Prop      | Type     | Default        | Description                      |
| --------- | -------- | -------------- | -------------------------------- |
| title     | `string` | -              | Header title                     |
| name      | `string` | auto-generated | Unique identifier                |
| minHeight | `string` | -              | Min content height when expanded |
| maxHeight | `string` | -              | Max content height (scrollable)  |

**Slots**: `default` (content), `header` (scoped: `{ collapse, state }`), `title`

```vue
<NueCollapse v-model="activeNames" accordion>
  <NueCollapseItem title="Section 1" name="s1">
    Content for section 1
  </NueCollapseItem>
  <NueCollapseItem title="Section 2" name="s2">
    Content for section 2
  </NueCollapseItem>
</NueCollapse>
```