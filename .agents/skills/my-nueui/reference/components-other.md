# Other Components

## NueIcon

Renders icon font glyphs. Prefixes the icon class with `icon-` automatically.

| Prop      | Type                 | Default   | Description                             |
| --------- | -------------------- | --------- | --------------------------------------- |
| name      | `string`             | `'blank'` | Icon name (becomes class `icon-{name}`) |
| size      | `string`             | -         | Font size CSS value                     |
| color     | `string`             | -         | Color CSS value                         |
| spin      | `boolean`            | -         | Enable spin animation                   |
| spinSpeed | `string`             | -         | Animation speed CSS value               |
| theme     | `string \| string[]` | -         | Theme classes                           |

```vue
<NueIcon name="search" size="20px" color="#333" />
<NueIcon name="loading" spin />
```

Complete icon name list: [icon-names.md](icon-names.md)

## NueInfiniteScroll

| Prop          | Type                                       | Default     | Description                     |
| ------------- | ------------------------------------------ | ----------- | ------------------------------- |
| height        | `string`                                   | -           | Wrapper height (enables scroll) |
| disabled      | `boolean`                                  | -           | Stop loading more               |
| loading       | `boolean`                                  | -           | Show loading indicator          |
| triggerHeight | `string`                                   | `'0px'`     | Sentinel height                 |
| root          | `Element \| Document \| null \| 'wrapper'` | `'wrapper'` | IntersectionObserver root       |
| rootMargin    | `string`                                   | -           | Observer rootMargin             |
| threshold     | `number \| number[]`                       | -           | Observer threshold              |

**Emits**: `loadMore()`
**Slots**: `default`, `loading`, `disabled`

```vue
<NueInfiniteScroll height="400px" :disabled="noMore" :loading="fetching" @loadMore="fetchData">
  <div v-for="item in items" :key="item.id">{{ item.name }}</div>
  <template #loading>Loading more...</template>
  <template #disabled>No more data</template>
</NueInfiniteScroll>
```
