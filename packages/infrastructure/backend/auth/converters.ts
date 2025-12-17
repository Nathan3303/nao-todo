import { UserEntity } from '@nao-todo/domain'
import type { SignInReq, SignUpReq } from '@nao-todo/infrastructure/backend/types/auth'

export const userEntity2SignInReq = (userEntity: UserEntity): SignInReq => {
    return {
        email: userEntity.email,
        password: userEntity.password
    }
}

export const userEntity2SignUpReq = (userEntity: UserEntity): SignUpReq => {
    return {
        email: userEntity.email,
        password: userEntity.password,
        nickname: userEntity.nickname
    }
}
