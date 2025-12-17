import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthDomain } from '@nao-todo/domain'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { signInVO2UserEntity, signUpVO2UserEntity } from './converters'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { Err, SignInVO, SignUpVO } from '@nao-todo/types'

const USER_JWT_LOCALSTORAGE_KEY = 'USER_JWT'
const USER_PASSWORD_REGEXP = /^\S*(?=\S{8})(?=\S*\d)(?=\S*[a-z])(?=\S*[!@#$%^&*?.-])\S*$/

export default defineStore('AuthAppStore', () => {
    // @domain Auth Domain
    const authDomain = useAuthDomain(useAuthRepository(getRequesterImpl()))

    // @state 用户凭据
    const userToken = ref<string>('')

    // @state 用户认证状态
    const isAuthenticated = ref<boolean>()

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
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt)
        userToken.value = jwt
        isAuthenticated.value = true
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
        const jwt = userToken.value ?? localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
        // 2. 调用域服务 - 检入
        const [newJwt, err] = await authDomain.checkIn(jwt)
        if (err) return err
        // 3. 赋值新的用户凭据
        userToken.value = newJwt
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, newJwt)
        isAuthenticated.value = true
        return null
    }

    // @method 登出
    const signOut = async (): Promise<Err> => {
        // 1. 检查是否登入
        if (!isAuthenticated.value) return null
        // 2. 获取用户凭据
        const jwt = userToken.value ?? localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
        // 3. 调用域服务 - 登出
        const err = await authDomain.signOut(jwt)
        if (err) return err
        // 4. 删除用户凭据
        userToken.value = ''
        localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
        isAuthenticated.value = false
        return null
    }

    return { isAuthenticated, signIn, signUp, checkIn, signOut }
})
