import type { User } from '@nao-todo/stores'

export type IndexHeaderProps = {
    user: User
}

export type IndexHeaderEmits = {
    (event: 'logout'): void
}
