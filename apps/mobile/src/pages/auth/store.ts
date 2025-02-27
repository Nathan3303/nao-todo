import { ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiBaseURL } from '@/constants'
import sparkMD5 from 'spark-md5'
import { getJWTPayload } from '@nao-todo/utils'
import useRequester from '@nao-todo/hooks/use-requester'
import type { ResponseData, SigninOptions, User } from '@nao-todo/types'

export const useAuthStore = defineStore('AuthStore', () => {
    const user = ref<User>()
    const token = ref<string>()
    const isAuthenticated = ref(false)

    const requester = useRequester()

    const signin = async (options: SigninOptions) => {
        const response = await requester.post('/signin', {
            email: options.email.trim().toLowerCase(),
            password: sparkMD5.hash(options.password)
        })
        const responseData = response.data as ResponseData
        if (responseData.code === 20000) {
            const jwt = (responseData.data as { token: string }).token
            uni.setStorageSync('USER_JWT', jwt)
            user.value = getJWTPayload(jwt)
            token.value = jwt
            isAuthenticated.value = true
        }
        return responseData
    }

    const checkin = async () => {
        const jwt = uni.getStorageSync('USER_JWT') || ''
        if (!jwt) return false
        const response = await uni.request({
            method: 'GET',
            url: ApiBaseURL + `/checkin?jwt=${jwt}`
        })
        const responseData = response.data as ResponseData
        if (responseData.code !== 20000) {
            uni.removeStorageSync('USER_JWT')
            user.value = void 0
            token.value = void 0
            isAuthenticated.value = false
        } else {
            const newJWT = (responseData.data as { token: string }).token
            uni.setStorageSync('USER_JWT', newJWT)
            user.value = getJWTPayload(newJWT)
            token.value = newJWT
            isAuthenticated.value = true
        }
        return responseData
    }

    return {
        user,
        token,
        isAuthenticated,
        signin,
        checkin
    }
})
