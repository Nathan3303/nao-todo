import type { ComponentPublicInstance } from 'vue'

// Backend api response type
export type * from './response'

// Requester type
export type * from './requester'

// Golang like error handling type support
export type * from './go'

// Models
export type * from '../infrastructure/local/models'

// View objects
export type * from './viewobjects/auth'
export type * from './viewobjects/user'
export type * from './viewobjects/project'
export type * from './viewobjects/task'
export type * from './viewobjects/tag'
export type * from './viewobjects/event'
export type * from './viewobjects/built-in-project'
export type * from './viewobjects/comment'

// Other types
export type ComponentRef<T> = ComponentPublicInstance<T> | null | undefined

