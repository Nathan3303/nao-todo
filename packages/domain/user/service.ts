import type { Err, GoLike } from '@nao-todo/types'
import type { UserRepository } from './repositories'
import type { UserEntity } from './user-entity'

interface UserDomain {
    updateNickname(nickname: string): Promise<Err>
    getProfile(): Promise<GoLike<UserEntity | null>>
}

export const useUserDomain = (userRepo: UserRepository): UserDomain => {
    return {
        updateNickname: userRepo.updateNickname,
        getProfile: userRepo.getProfile
    }
}
