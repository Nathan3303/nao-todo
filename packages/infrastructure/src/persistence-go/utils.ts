import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'

export const getJWTFromLocalStorage = (): string | null => {
    return localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
}