# Form Components

All form components support `v-model` for two-way binding.

## NueInput

| Prop              | Type                                                        | Default                | Description                          |
| ----------------- | ----------------------------------------------------------- | ---------------------- | ------------------------------------ |
| type              | `'text' \| 'password' \| 'number' \| 'email' \| 'textarea'` | `'text'`               | Input type                           |
| modelValue        | `string \| number`                                          | -                      | v-model value                        |
| placeholder       | `string`                                                    | `'Input something...'` | Placeholder                          |
| shape             | `'rounded' \| 'noshape'`                                    | -                      | Visual shape                         |
| icon              | `string`                                                    | -                      | Leading icon name                    |
| size              | `'small' \| 'large'`                                        | -                      | Size                                 |
| width             | `string`                                                    | -                      | CSS width                            |
| flex              | `string \| boolean`                                         | -                      | CSS flex                             |
| maxlength         | `string`                                                    | -                      | Max characters                       |
| disabled          | `boolean`                                                   | -                      | Disabled                             |
| readonly          | `boolean`                                                   | -                      | Readonly                             |
| clearable         | `boolean`                                                   | -                      | Show clear button                    |
| allowShowPassword | `boolean`                                                   | -                      | Show password toggle (type=password) |
| counter           | `'off' \| 'word-limit' \| 'word-left' \| 'both'`            | `'off'`                | Character counter                    |
| debounceTime      | `number`                                                    | `0`                    | Debounce model update in ms          |
| id                | `string`                                                    | -                      | Native id                            |
| name              | `string`                                                    | -                      | Native name                          |

**Emits**: `update:modelValue(value)`, `input(Event)`, `blur(Event)`, `change(Event)`

```vue
<NueInput v-model="username" icon="user" placeholder="Username" clearable />
<NueInput v-model="password" type="password" allowShowPassword />
<NueInput v-model="search" debounceTime="300" counter="word-left" :maxlength="100" />
```

## NueTextarea

| Prop         | Type                                              | Default | Description       |
| ------------ | ------------------------------------------------- | ------- | ----------------- |
| modelValue   | `string`                                          | -       | v-model value     |
| placeholder  | `string`                                          | -       | Placeholder       |
| rows         | `number`                                          | `3`     | Visible rows      |
| resize       | `boolean`                                         | -       | Allow CSS resize  |
| autosize     | `boolean \| { minRows: number; maxRows: number }` | -       | Auto-grow height  |
| shape        | `'rounded' \| 'noshape'`                          | -       | Visual shape      |
| size         | `'small' \| 'large'`                              | -       | Size              |
| width        | `string`                                          | -       | CSS width         |
| flex         | `string`                                          | -       | CSS flex          |
| maxlength    | `string`                                          | -       | Max characters    |
| disabled     | `boolean`                                         | -       | Disabled          |
| readonly     | `boolean`                                         | -       | Readonly          |
| counter      | `'off' \| 'word-limit' \| 'word-left' \| 'both'`  | `'off'` | Character counter |
| debounceTime | `number`                                          | `0`     | Debounce delay    |
| id           | `string`                                          | -       | Native id         |

**Emits**: `update:modelValue(value)`, `input(Event)`, `blur(Event)`, `change(Event)`

```vue
<NueTextarea v-model="bio" placeholder="Bio..." :autosize="{ minRows: 2, maxRows: 6 }" />
```

## NueCheckbox

| Prop          | Type                                              | Default        | Description                 |
| ------------- | ------------------------------------------------- | -------------- | --------------------------- |
| modelValue    | `boolean`                                         | -              | Checked state (v-model)     |
| label         | `string`                                          | -              | Label text                  |
| name          | `string`                                          | auto-generated | Unique name (used by group) |
| size          | `'small' \| 'large'`                              | -              | Size                        |
| disabled      | `boolean`                                         | `false`        | Disabled                    |
| loading       | `boolean`                                         | `false`        | Loading                     |
| indeterminate | `boolean`                                         | -              | Partial check               |
| beforeCheck   | `(state: boolean) => boolean \| Promise<boolean>` | -              | Async guard                 |

**Emits**: `update:modelValue(boolean)`, `change(boolean)`, `checked()`, `unchecked()`

## NueCheckboxGroup

| Prop            | Type                 | Default    | Description                   |
| --------------- | -------------------- | ---------- | ----------------------------- |
| modelValue      | `string[]`           | -          | Checked names array (v-model) |
| size            | `'small' \| 'large'` | -          | Child size                    |
| disabled        | `boolean`            | `false`    | Disable all                   |
| useController   | `boolean`            | `false`    | Show select-all toggle        |
| controllerLabel | `string`             | -          | Controller label text         |
| min             | `number`             | `0`        | Minimum checked required      |
| max             | `number`             | `Infinity` | Maximum checked allowed       |

**Slot**: `controller` — scoped `{ controllerState, isIndeterminate }`

```vue
<NueCheckboxGroup v-model="checked" :min="1" :max="3" useController controllerLabel="Select All">
  <NueCheckbox label="Option A" name="a" />
  <NueCheckbox label="Option B" name="b" />
  <NueCheckbox label="Option C" name="c" />
</NueCheckboxGroup>
```

## NueSwitch

| Prop         | Type                                   | Default     | Description            |
| ------------ | -------------------------------------- | ----------- | ---------------------- |
| modelValue   | `boolean`                              | -           | Switch state (v-model) |
| size         | `'small' \| 'normal' \| 'large'`       | -           | Size                   |
| disabled     | `boolean`                              | `false`     | Disabled               |
| loading      | `boolean`                              | `false`     | Loading                |
| loadingIcon  | `string`                               | `'loading'` | Loading icon           |
| showText     | `boolean`                              | `false`     | Show on/off text       |
| activeText   | `string`                               | `'I'`       | Active text            |
| inactiveText | `string`                               | `'O'`       | Inactive text          |
| beforeSwitch | `(value: boolean) => Promise<boolean>` | -           | Async guard            |

**Emits**: `update:modelValue(boolean)`, `change(boolean)`

```vue
<NueSwitch v-model="enabled" showText activeText="ON" inactiveText="OFF" />
<NueSwitch v-model="loading" :beforeSwitch="confirmSwitch" />
```

## NueSelect + NueSelectOption

**NueSelect**:

| Prop        | Type                 | Default        | Description               |
| ----------- | -------------------- | -------------- | ------------------------- |
| modelValue  | `unknown`            | -              | Selected value (v-model)  |
| placeholder | `string`             | `'请选择 ...'` | Placeholder               |
| size        | `'small' \| 'large'` | -              | Size                      |
| disabled    | `boolean`            | -              | Disabled                  |
| clearable   | `boolean`            | `false`        | Show clear button         |
| persistent  | `boolean`            | -              | Keep open after selection |

**Emits**: `update:modelValue(value)`, `change(value)`, `close()`

**NueSelectOption**:

| Prop        | Type      | Default      | Description  |
| ----------- | --------- | ------------ | ------------ |
| label       | `string`  | **required** | Display text |
| value       | `unknown` | **required** | Option value |
| icon        | `string`  | -            | Icon name    |
| loading     | `boolean` | -            | Loading      |
| loadingIcon | `string`  | -            | Loading icon |
| disabled    | `boolean` | -            | Disabled     |

**Slots**: `default` (custom content), `append`

```vue
<NueSelect v-model="selected" placeholder="Choose..." clearable>
  <NueSelectOption label="Apple" :value="1" />
  <NueSelectOption label="Banana" :value="2" />
  <NueSelectOption label="Cherry" :value="3" disabled />
</NueSelect>
```

## NueDatePicker

| Prop        | Type                   | Default  | Description               |
| ----------- | ---------------------- | -------- | ------------------------- |
| modelValue  | `string \| null`       | -        | ISO date string (v-model) |
| type        | `'date' \| 'datetime'` | `'date'` | Picker mode               |
| placeholder | `string`               | `''`     | Placeholder               |
| disabled    | `boolean`              | `false`  | Disabled                  |
| clearable   | `boolean`              | `false`  | Show clear button         |

**Emits**: `update:modelValue(string | null)`, `change(value)`, `clear()`, `close()`

```vue
<NueDatePicker v-model="birthday" placeholder="Select date" clearable />
<NueDatePicker v-model="appointment" type="datetime" />
```
