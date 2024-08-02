import type { User } from "@/stores"

export type IndexHeaderProps = {
    user: User
}

export type IndexHeaderEmits = {
    (event: 'logout'): void
}
