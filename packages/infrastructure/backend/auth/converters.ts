import { SignInValueObject, SignUpValueObject } from '@nao-todo/domain/auth'
import type { Go } from '@nao-todo/shared'
import type { SignInReq, SignUpReq } from '../models/auth'

export const signInValueObjectToSignInReq = (
    signInValueObject: SignInValueObject
): Go<SignInReq> => {
    return [
        {
            email: signInValueObject.email,
            password: signInValueObject.password
        },
        null
    ]
}

export const signUpValueObjectToSignUpReq = (
    signUpValueObject: SignUpValueObject
): Go<SignUpReq> => {
    return [
        {
            email: signUpValueObject.email,
            password: signUpValueObject.password,
            nickname: signUpValueObject.nickname
        },
        null
    ]
}
