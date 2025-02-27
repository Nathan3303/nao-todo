import { ref } from 'vue'
import { defineStore } from 'pinia'
import { SigninOptions, SignupOptions, User } from '@nao-todo/types'
import { checkInApiV2, signInApiV2, signOutApiV2, signUpApiV2 } from '@nao-todo/apis'
import getJWTPayload from '@nao-todo/utils/get-jwt-payload'
import useRequester from '@nao-todo/hooks/use-requester'
import useApiResult from '@nao-todo/hooks/use-api-result'

export default defineStore('UserStore', () => {
    const $requester = useRequester()
    const user = ref<User | null>(null)
    const token = ref<string>('')

    const _setUserState = (jwt: string) => {
        user.value = getJWTPayload(jwt)
        token.value = jwt
    }

    const signIn = async (options: SigninOptions) => {
        const response = await signInApiV2($requester, options)
        if (response.code !== 20000) {
            return useApiResult(101, '登录失败,' + response.message)
        }
        const { token: jwt } = response.data as { token: string }
        _setUserState(jwt)
        return useApiResult(100, '登录成功', { token: jwt })
    }

    const signUp = async (options: SignupOptions) => {
        const response = await signUpApiV2($requester, options)
        if (response.code !== 20000) {
            return useApiResult(111, '注册失败,' + response.message)
        } else {
            return useApiResult(110, '注册成功')
        }
    }

    const _resetUserState = () => {
        user.value = null
        token.value = ''
    }

    const checkIn = async (jwt?: string) => {
        if (!jwt) {
            _resetUserState()
            return useApiResult(121, '检入失败，用户凭证为空')
        }
        const response = await checkInApiV2($requester, jwt)
        if (response.code !== 20000) {
            _resetUserState()
            // await signOut()
            return useApiResult(122, '检入失败，用户凭证无效')
        }
        const { token: newJwt } = response.data as { token: string }
        _setUserState(newJwt)
        return useApiResult(120, '检入成功', { token: jwt })
    }

    const signOut = async (jwt?: string) => {
        jwt = jwt ? jwt : token.value
        if (!jwt) {
            _resetUserState()
            return useApiResult(131, '登出失败，用户凭证为空')
        }
        const response = await signOutApiV2($requester, jwt)
        if (response.code !== 20000) {
            return useApiResult(132, '登出失败，用户凭证无效')
        }
        _resetUserState()
        return useApiResult(130, '登出成功')
    }

    return { user, token, signIn, signUp, checkIn, signOut }
})
