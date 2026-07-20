import { SignInValueObject, SignUpValueObject } from '@nao-todo/domain/auth'
import type { SignInViewObject, SignUpViewObject } from '../viewobjects'

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

