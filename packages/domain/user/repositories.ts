import type { Go, GoAsync } from '@nao-todo/types'
import type { UserConfigEntity, UserEntity } from './entities'
import type {
    UpdateNicknameValueObject,
    UpdatePasswordValueObject,
    UpdateUserConfigValueObject
} from './valueobjects'

export interface UserRepository {
    getProfile(): GoAsync<UserEntity>
    updateNickname(updateNicknameValueObject: UpdateNicknameValueObject): GoAsync<void>
    updatePassword(updatePasswordValueObject: UpdatePasswordValueObject): GoAsync<void>
    updateAvatarURL(url: string): GoAsync<string>
    updateAvatarFile(file: File): GoAsync<string>
    deactive(): GoAsync<void>
    active(): GoAsync<void>
    getConfig(): GoAsync<UserConfigEntity>
    updateConfig(valueObject: UpdateUserConfigValueObject): GoAsync<void>

    encryptPassword(password: string): Go<string>
}

