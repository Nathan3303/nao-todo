import type { SignUpValueObject, SignInValueObject } from './valueobjects'
import type { Go, GoAsync } from '@nao-todo/types'

export interface AuthRepository {
    signIn(signInValueObject: SignInValueObject): GoAsync<string>
    encryptPassword(password: string): Go<string>
    signUp(signUpValueObject: SignUpValueObject): GoAsync<void>
    checkIn(jwt: string): GoAsync<string>
    signOut(jwt: string): GoAsync<void>
    saveJwtToLocalStorage(jwt: string): Go<void>
    getJwtFromLocalStorage(): string | null
    removeJwtFromLocalStorage(): Go<void>
}
