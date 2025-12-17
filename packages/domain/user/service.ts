import type { Err } from "@nao-todo/types"
import { UserRepository } from "./repositories"

interface UserDomain {
    updateNickname(nickname: string): Promise<Err>
}

export const useUserDomain = (userRepo: UserRepository): UserDomain => {
    const updateNickname = async (nickname: string): Promise<Err> => {
        return userRepo.updateNickname(nickname)
    }

    return { updateNickname }
}
