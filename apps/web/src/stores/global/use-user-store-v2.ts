import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAxios } from '@nao-todo/hooks'
import getJWTPayload from '@nao-todo/utils/get-jwt-payload'
import { NueConfirm } from 'nue-ui'
import type { User, SigninOptions, SignupOptions, GoLike, Requester } from '@nao-todo/types'
import {
    signInApi,
    signUpApi,
    checkInApi,
    signOutApi,
    updateNicknameApi,
    updatePasswordApi
} from '@nao-todo/apis/v2'
import { unwrapError } from '@nao-todo/utils'

const USER_JWT_LOCALSTORAGE_KEY = 'USER_JWT'
const BASE_URL = 'http://localhost:3303/api/user/'
const SIGN_UP_SUCCESS_CODE = 10000
const SIGN_IN_SUCCESS_CODE = 10010
const CHECK_IN_SUCCESS_CODE = 10020
const SIGN_OUT_SUCCESS_CODE = 10030
const UPDATE_PROFILE_SUCCESS_CODE = 10050
const UPDATE_PASSWORD_SUCCESS_CODE = 10060
const USER_PASSWORD_REGEXP = /^\S*(?=\S{8})(?=\S*\d)(?=\S*[a-z])(?=\S*[!@#$%^&*?.-])\S*$/

const useUserStoreV2 = defineStore('UserStore', () => {
    const requester = useAxios(BASE_URL)
    const router = useRouter()

    // @state 用户信息
    const user = ref<User>()

    // @state 用户 JWT
    const userJwt = ref<string>()

    // @state 用户认证状态
    const isAuthenticated = ref<boolean>()

    // @method 用户注册
    const signup = async (options: SignupOptions, req?: Requester): Promise<GoLike> => {
        // 检查属性值
        if (options.email === '') return [null, '请输入邮箱']
        if (options.password.length < 8 || options.password.length > 24)
            return [null, '密码格式有误，需要 8 至 24 位的长度']
        if (!new RegExp(USER_PASSWORD_REGEXP).test(options.password))
            return [null, '密码格式有误，需要包含字母、数字以及特殊符号']
        // 调用 API
        const result = await signUpApi(req || requester, options)
        // 判断是否成功
        if (result.code === SIGN_UP_SUCCESS_CODE) {
            // 返回登录成功
            return [true, null]
        }
        // 返回失败信息
        return [null, result.message]
    }

    // @method 用户登录
    const signin = async (options: SigninOptions, req?: Requester): Promise<GoLike> => {
        // 检查属性值
        if (options.email === '') return [null, '请输入邮箱']
        if (options.password === '') return [null, '请输入密码']
        // 调用 API
        const result = await signInApi(req || requester, options)
        // 判断是否成功
        if (result.code === SIGN_IN_SUCCESS_CODE) {
            // 保存 JWT 和用户信息
            const jwt = result.data as string
            localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt)
            user.value = getJWTPayload(jwt) as User
            userJwt.value = jwt
            isAuthenticated.value = true
            // 返回登录成功
            return [true, null]
        }
        // 返回失败信息
        return [null, result.message]
    }

    // @method 用户检入 - 用户二次登录简单校验
    const checkin = async (req?: Requester): Promise<GoLike> => {
        // 获取并检查属性值
        const localUserJwt = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
        if (!localUserJwt) {
            return [null, '本地用户凭证无效']
        }
        // 调用 API
        const result = await checkInApi(req || requester, localUserJwt)
        // 判断是否成功
        if (result.code === CHECK_IN_SUCCESS_CODE) {
            // 保存 JWT 和用户信息
            const jwt = result.data as string
            localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt)
            user.value = getJWTPayload(jwt) as User
            userJwt.value = jwt
            isAuthenticated.value = true
            // 返回登录成功
            return [true, null]
        }
        // 失败后续
        localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
        user.value = void 0
        userJwt.value = void 0
        isAuthenticated.value = false
        // 返回失败信息
        return [null, result.message]
    }

    // @method 用户登出
    const signout = async (req?: Requester): Promise<GoLike> => {
        // 检查属性值
        if (!userJwt.value) return [null, '用户凭证无效,已登出']
        // 调用 API
        const result = await signOutApi(req || requester, userJwt.value)
        // 判断是否成功
        if (result.code === SIGN_OUT_SUCCESS_CODE) {
            localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
            user.value = void 0
            userJwt.value = void 0
            isAuthenticated.value = false
            return [true, null]
        }
        // 返回失败信息
        return [null, result.message]
    }

    // @method 用户登出并跳转登录页
    const signoutAndRedirect = async (req?: Requester): Promise<GoLike> => {
        // 调用登出 API
        const [, err] = await signout(req || requester)
        // 判断是否成功
        if (err) {
            console.error(unwrapError(err))
            return [null, err]
        }
        router.push({ path: '/auth/signin' })
        return [null, null]
    }

    // @method 更新用户昵称
    const updateNickname = async (newNickname: string, req?: Requester): Promise<GoLike> => {
        // 检查是否登录
        if (!isAuthenticated.value) return [null, '请先登录']
        // 检查属性值
        newNickname = newNickname.trim()
        if (!newNickname) return [null, '用户昵称不允许为空']
        // 调用 API
        const result = await updateNicknameApi(req || requester, newNickname)
        // 判断是否成功
        if (result.code === UPDATE_PROFILE_SUCCESS_CODE && user.value) {
            user.value.nickname = newNickname
            return [true, null]
        }
        // 返回失败结果
        return [null, result.message]
    }

    // @method 更新用户密码
    const updatePassword = async (
        oldPassword: string,
        newPassword: string,
        req?: Requester
    ): Promise<GoLike> => {
        // 检查是否登录
        if (!isAuthenticated.value) return [null, '请先登录']
        // 检查属性值
        if (!new RegExp(USER_PASSWORD_REGEXP).test(oldPassword)) return [null, '旧密码错误']
        if (!new RegExp(USER_PASSWORD_REGEXP).test(newPassword)) return [null, '新密码格式错误']
        // 调用 API
        const result = await updatePasswordApi(req || requester, oldPassword, newPassword)
        // 判断是否成功
        if (result.code === UPDATE_PASSWORD_SUCCESS_CODE) {
            // 退出登录
            localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
            user.value = void 0
            userJwt.value = void 0
            isAuthenticated.value = false
            await NueConfirm({
                title: '修改密码成功',
                content: '您已成功修改密码，需要重新登录以获取新的用户凭证',
                unuseCancelButton: true,
                confirmButtonText: '好'
            }).then(() => router.replace('/auth/signin'))
            return [true, null]
        }
        // 返回失败结果
        return [null, result.message]
    }

    // const updateAvatar = async (avatar: File | undefined, req?: Requester): Promise<GoLike> => {
    //     // 检查是否登录
    //     if (!isAuthenticated.value) return [null, '请先登录']
    //     // 检查属性值
    //     if (!avatar) return [null, '图片无效']
    //     if (!['image/jpeg', 'image/png', 'image/gif'].includes(avatar.type))
    //         return [null, '图片格式无效']
    //     if (avatar.size > 5 * 1024 * 1024) return [null, '图片大小不能超过 5 M']
    //     // 调用 API
    //     const formData = new FormData()
    //     formData.append('avatar', avatar)
    //     const result = await updateAvatarApi(formData)
    //     const responseData = result.data as { url: string }
    //     // 判断是否成功
    //     if (result.code === 20000 && user.value) {
    //         user.value.avatar = responseData.url + '?t=' + Date.now()
    //         return [responseData.url, null]
    //     }
    //     // 返回失败结果
    //     return [null, result.message]
    // }

    return {
        user,
        isAuthenticated,
        signin,
        signup,
        checkin,
        signout,
        signoutAndRedirect,
        updateNickname,
        updatePassword
        // updateAvatar
    }
})

export default useUserStoreV2
