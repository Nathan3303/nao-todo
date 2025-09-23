import type { ComponentPublicInstance } from 'vue'

// axios
export type * from './axios/common'

// models
export type * from './models/user'
export type * from './models/project'
export type * from './models/todo'
export type * from './models/event'
export type * from './models/tag'
export type * from './models/comment'

// views
export type * from './views/tasks'

// requester
export type * from './requester'

// Golang like error handling type support
export type Err = Error | string | Error[] | string[] | null
export type GoLike<T = any> = [T, Err]

// other
export type ComponentRef<T> = ComponentPublicInstance<T> | null | undefined
