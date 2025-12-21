import type { UserEntity } from './user-entity'
import type { Err, GoLike } from '@nao-todo/types'

export interface AuthRepository {
    signIn(userEntity: UserEntity): Promise<GoLike<string>>
    encryptPassword(password: string): GoLike<string>
    signUp(userEntity: UserEntity): Promise<Err>
    checkIn(jwt: string): Promise<GoLike<string>>
    signOut(jwt: string): Promise<Err>
}
