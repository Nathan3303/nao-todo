export type StateFn = () => boolean | Promise<boolean>

export type States = StateFn[]

export type StateError = {
    message: string | null
}
