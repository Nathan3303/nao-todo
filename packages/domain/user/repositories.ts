import type { GoAsync, UserProfile } from '@nao-todo/types'
import type { UserEntity } from './entities'

export interface UserRepository {
    updateNickname(newNickname: UserProfile['nickname']): GoAsync<void>
    getProfile(): GoAsync<UserEntity>
    updatePassword(oldPassword: string, newPassword: string): GoAsync<void>
    updateAvatarURL(url: string): GoAsync<string>
    deactive(): GoAsync<void>
    active(): GoAsync<void>
}
