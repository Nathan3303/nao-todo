import { UserEntity } from './user-entity'
import type { AuthRepository } from './repositories'
import type { Err, GoLike } from '@nao-todo/types'

interface AuthDomain {
    signIn(userEntity: UserEntity): Promise<GoLike<string>>
    signUp(userEntity: UserEntity): Promise<Err>
    checkIn(userToken: string): Promise<GoLike<string>>
    signOut(userToken: string): Promise<Err>
}

export const useAuthDomain = (authRepo: AuthRepository): AuthDomain => {
    const signIn = async (userEntity: UserEntity): Promise<GoLike<string>> => {
        const [ePasswd, err] = authRepo.encryptPassword(userEntity.password)
        if (err) {
            return ['', err]
        }
        userEntity.password = ePasswd
        return authRepo.signIn(userEntity)
    }

    const signUp = async (userEntity: UserEntity): Promise<Err> => {
        const [ePasswd, err] = authRepo.encryptPassword(userEntity.password)
        if (err) {
            return err
        }
        userEntity.password = ePasswd
        return authRepo.signUp(userEntity)
    }

    const checkIn = async (userToken: string): Promise<GoLike<string>> => {
        return authRepo.checkIn(userToken)
    }

    const signOut = async (userToken: string): Promise<Err> => {
        return authRepo.signOut(userToken)
    }

    return { signIn, signUp, checkIn, signOut }
}
