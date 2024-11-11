import type { User } from '@nao-todo/stores'

export type UserDropdownProps = {
    user?: User & { avatarUrl?: string }
}

export type UserDropdownEmits = {
    (event: 'logout', id?: User['id']): void
}