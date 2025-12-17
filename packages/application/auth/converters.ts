import type { SignInVO, SignUpVO } from '@nao-todo/types'
import { UserEntity } from '@nao-todo/domain'

export const signInVO2UserEntity = (signInVO: SignInVO): UserEntity => {
    const userEntity = new UserEntity()
    userEntity.email = signInVO.email
    userEntity.password = signInVO.password
    return userEntity
}

export const signUpVO2UserEntity = (signUpVO: SignUpVO): UserEntity => {
    const userEntity = new UserEntity()
    userEntity.email = signUpVO.email
    userEntity.password = signUpVO.password
    userEntity.nickname = signUpVO.nickname
    return userEntity
}
