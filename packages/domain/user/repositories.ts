import type { Go, GoAsync } from '@nao-todo/types'
import type { UserEntity } from './entities'
import type { UpdateNicknameValueObject, UpdatePasswordValueObject } from './valueobjects'

export interface UserRepository {
    getProfile(): GoAsync<UserEntity>
    updateNickname(updateNicknameValueObject: UpdateNicknameValueObject): GoAsync<void>
    updatePassword(updatePasswordValueObject: UpdatePasswordValueObject): GoAsync<void>
    updateAvatarURL(url: string): GoAsync<string>
    updateAvatarFile(file: File): GoAsync<string>
    deactive(): GoAsync<void>
    active(): GoAsync<void>

    encryptPassword(password: string): Go<string>
}
