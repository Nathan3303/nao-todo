import type { ComponentPublicInstance } from 'vue'

// Backend api response type
export type * from './response'

// Golang like error handling type support
export type * from './go'

// Other types
export type ComponentRef<T> = ComponentPublicInstance<T> | null | undefined

