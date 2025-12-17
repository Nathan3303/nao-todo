import { Err, GoLike } from '@nao-todo/types'
import { UserEntity } from './user-entity'

export interface UserRepository {
    updateNickname(nickname: string): Promise<Err>
    getProfile(): Promise<GoLike<UserEntity | null>>
    updatePassword(oldPassword: string, newPassword: string): Promise<Err>
    updateAvatarURL(url: string): Promise<GoLike<string | null>>
    deactive(): Promise<Err>
    active(): Promise<Err>
}
