import type { SignInVO, SignUpVO } from '@nao-todo/types'
import type { UserEntity } from '@nao-todo/domain'
import { makeUserEntity } from '@nao-todo/domain/auth/user-entity'

export const signInVO2UserEntity = (signInVO: SignInVO): UserEntity => {
    const userEntity = makeUserEntity()
    userEntity.email = signInVO.email
    userEntity.password = signInVO.password
    return userEntity
}

export const signUpVO2UserEntity = (signUpVO: SignUpVO): UserEntity => {
    const userEntity = makeUserEntity()
    userEntity.email = signUpVO.email
    userEntity.password = signUpVO.password
    userEntity.nickname = signUpVO.nickname
    return userEntity
}
