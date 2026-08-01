# Programmatic APIs

These components are called imperatively from JavaScript — they do not use templates.

## NueMessage

Toast notifications.

**Requires**: `<NueMessageWrapper />` mounted somewhere in your app (e.g., in `App.vue`).

```ts
import { NueMessage } from 'nue-ui'

// Basic
NueMessage({ message: 'Operation succeeded', type: 'success', duration: 3000 })

// Convenience methods
NueMessage.success('Saved!')
NueMessage.error('Failed to save')
NueMessage.warn('Proceed with caution')
NueMessage.info('New update available')
NueMessage.log('Debug info')

// Persistent (no duration, shows close button)
NueMessage({ message: 'Persistent message', type: 'info' })
```

**Payload**: `{ message: string; type?: 'success' | 'error' | 'warning' | 'info' | 'log'; duration?: number; icon?: string; size?: 'small' | 'large' }`

## NueConfirm

Programmatic confirmation dialog.

```ts
import { NueConfirm } from 'nue-ui'

const [isCancelled, result] = await NueConfirm({
    title: 'Delete item?',
    content: 'This action cannot be undone.',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel'
})

if (!isCancelled) {
    // user confirmed — result is the value passed to onConfirm or the dialog state
}
```

**Returns**: `Promise<[isByCancel: boolean, onConfirmResult: unknown]>`

**Full payload options**:

| Option            | Type                                            | Description                                          |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------- |
| title             | `string`                                        | Dialog title                                         |
| content           | `string`                                        | Dialog content text                                  |
| confirmButtonText | `string`                                        | Confirm button label                                 |
| cancelButtonText  | `string`                                        | Cancel button label                                  |
| unuseCancelButton | `boolean`                                       | Hide cancel button                                   |
| loading           | `boolean`                                       | Loading state for confirm                            |
| animation         | `string \| { name: string; duration?: number }` | Open animation                                       |
| closeAnimation    | `string \| { name: string; duration?: number }` | Close animation                                      |
| onConfirm         | `() => unknown`                                 | Called on confirm, result passed to returned Promise |
| beforeOpen        | `() => void`                                    | Hook before dialog opens                             |
| afterOpen         | `() => void`                                    | Hook after dialog opens                              |
| afterConfirm      | `() => void`                                    | Hook after confirm action                            |
| afterCancel       | `() => void`                                    | Hook after cancel action                             |
| beforeClose       | `() => void`                                    | Hook before dialog closes                            |
| afterClose        | `() => void`                                    | Hook after dialog closes                             |

## NuePrompt

Programmatic input prompt dialog.

```ts
import { NuePrompt } from 'nue-ui'

const [isCancelled, inputValue] = await NuePrompt({
    title: 'Enter name',
    placeholder: 'Your name',
    inputType: 'text',
    validator: (value) => {
        if (!value) return 'Name is required'
        return null // null = valid, string = error message
    }
})

if (!isCancelled) {
    console.log('User entered:', inputValue)
}
```

**Returns**: `Promise<[isByCancel: boolean, inputValue: unknown]>`

**Full payload options**:

| Option            | Type                                            | Description                                          |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------- |
| title             | `string`                                        | Prompt title                                         |
| description       | `string`                                        | Additional description text                          |
| placeholder       | `string`                                        | Input placeholder                                    |
| inputType         | `string`                                        | Input type (text, password, etc.)                    |
| inputValue        | `unknown`                                       | Initial input value                                  |
| confirmButtonText | `string`                                        | Confirm button label                                 |
| cancelButtonText  | `string`                                        | Cancel button label                                  |
| validator         | `(value: unknown) => string \| null`            | Validator: return error string or null               |
| onConfirm         | `(value: unknown) => unknown`                   | Called on confirm, result passed to returned Promise |
| animation         | `string \| { name: string; duration?: number }` | Open animation                                       |
| closeAnimation    | `string \| { name: string; duration?: number }` | Close animation                                      |
| beforeOpen        | `() => void`                                    | Hook before dialog opens                             |
| afterOpen         | `() => void`                                    | Hook after dialog opens                              |
| beforeClose       | `() => void`                                    | Hook before dialog closes                            |
| afterClose        | `() => void`                                    | Hook after dialog closes                             |

## Setup Requirements

Mount these once in your root component:

```vue
<!-- App.vue -->
<template>
    <NueMessageWrapper />
    <router-view />
</template>
```

`<NuePopupPool />` is auto-created on first use — no manual mounting needed unless you need a custom `id`.