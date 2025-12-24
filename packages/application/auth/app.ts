import { signInVO2UserEntity, signUpVO2UserEntity } from './converters'
import {
    USER_JWT_LOCALSTORAGE_KEY,
    USER_PASSWORD_REGEXP
} from '@nao-todo/infrastructure/consts/auth'
import type { Reactive } from 'vue'
import type { AuthDomain } from '@nao-todo/domain'
import type { Err, SignInVO, SignUpVO } from '@nao-todo/types'

export type AuthAppStates = Reactive<{
    userToken: string | null
    isAuthenticated: boolean
}>

export interface AuthApp {
    states: AuthAppStates
    signIn: (signInVO: SignInVO) => Promise<Err>
    signUp: (signUpVO: SignUpVO) => Promise<Err>
    checkIn: () => Promise<Err>
    signOut: () => Promise<Err>
}

const useAuthDomain = (authDomain: AuthDomain, authAppStates: AuthAppStates): AuthApp => {
    // @method 登录
    const signIn = async (vo: SignInVO): Promise<Err> => {
        // 1. 检查属性值
        if (vo.email === '') return '请输入邮箱'
        if (vo.password === '') return '请输入密码'
        // 2. VO转实体
        const userEntity = signInVO2UserEntity(vo)
        // 3. 调用域服务 - 登录
        const [jwt, err] = await authDomain.signIn(userEntity)
        if (err) return err
        // 4. 存储JWT
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt!)
        authAppStates.userToken = jwt!
        authAppStates.isAuthenticated = true
        // 5. 返回
        return null
    }

    // @method 注册
    const signUp = async (vo: SignUpVO): Promise<Err> => {
        // 1. 检查属性值
        if (vo.email === '') return '请输入邮箱'
        if (vo.password === '') return '请输入密码'
        if (vo.passwordConfirm === '') return '请输入确认密码'
        if (vo.password !== vo.passwordConfirm) return '密码不一致'
        // 2. 检查密码格式
        if (vo.password.length < 8 || vo.password.length > 24)
            return '密码格式有误，需要 8 至 24 位的长度'
        if (
            !USER_PASSWORD_REGEXP.test(vo.password) ||
            !USER_PASSWORD_REGEXP.test(vo.passwordConfirm)
        ) {
            return '密码格式错误'
        }
        // 3. VO转实体
        const userEntity = signUpVO2UserEntity(vo)
        // 4. 调用域服务 - 注册
        const err = await authDomain.signUp(userEntity)
        if (err) return err
        // 5. 返回
        return null
    }

    // @method 检入
    const checkIn = async (): Promise<Err> => {
        // 1. 获取用户凭据
        const jwt = authAppStates.userToken ?? localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
        if (!jwt) return '用户未登入'
        // 2. 调用域服务 - 检入
        const [newJwt, err] = await authDomain.checkIn(jwt)
        if (err) return err
        // 3. 赋值新的用户凭据
        authAppStates.userToken = newJwt!
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, newJwt!)
        authAppStates.isAuthenticated = true
        return null
    }

    // @method 登出
    const signOut = async (): Promise<Err> => {
        // 1. 检查是否登入
        if (!authAppStates.isAuthenticated) return null
        // 2. 获取用户凭据
        const jwt = authAppStates.userToken ?? localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
        if (!jwt) return '用户未登入'
        // 3. 调用域服务 - 登出
        const err = await authDomain.signOut(jwt)
        if (err) return err
        // 4. 删除用户凭据
        authAppStates.userToken = ''
        localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
        authAppStates.isAuthenticated = false
        return null
    }

    // @returns
    return { states: authAppStates, signIn, signUp, checkIn, signOut }
}

export default useAuthDomain
