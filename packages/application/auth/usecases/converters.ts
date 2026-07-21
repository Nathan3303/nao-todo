import { AuthSessionValueObject, SignInValueObject, SignUpValueObject } from '@nao-todo/domain/auth'
import type { SignInSessionViewObject, SignInViewObject, SignUpViewObject } from '../viewobjects'

/**
 * 登录视图对象转换为值对象
 * @param viewObject 登录视图对象
 * @returns 登录值对象
 */
export const signInViewObject2ValueObject = (viewObject: SignInViewObject): SignInValueObject => {
    return new SignInValueObject(viewObject.email, viewObject.password)
}

/**
 * 注册视图对象转换为值对象
 * @param viewObject 注册视图对象
 * @returns 注册值对象
 */
export const signUpViewObject2ValueObject = (viewObject: SignUpViewObject): SignUpValueObject => {
    return new SignUpValueObject(
        viewObject.email,
        viewObject.password,
        viewObject.confirmPassword,
        viewObject.nickname
    )
}

/**
 * 登录结果值对象转换为视图对象
 * @param valueObject 登录结果值对象
 * @returns 登录结果视图对象
 */
export const sessionValueObject2ViewObject = (
    valueObject: AuthSessionValueObject
): SignInSessionViewObject => {
    return {
        token: valueObject.jwt,
        pendingDeletion: valueObject.pendingDeletion,
        deletionDeadline: valueObject.deletionDeadline || null
    }
}
