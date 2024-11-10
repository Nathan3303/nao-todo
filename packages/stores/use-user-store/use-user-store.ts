import md5 from 'md5'
import $axios from '@nao-todo/utils/axios'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, SigninPayload, SignupPayload, ResponseData } from './types'

const getJWTPayload = (jwt: string) => {
    const jwtPayload = jwt.split('.')[1]
    const decodedPayload = JSON.parse(atob(jwtPayload))
    return decodedPayload as User
}

export const useUserStore = defineStore('userStore', () => {
    const user = ref<User>()
    const token = ref<string>()
    const isAuthenticated = ref(false)

    const signin = async (payload: SigninPayload) => {
        try {
            const { email, password } = payload
            const response = await $axios.post('/signin', {
                email: email.trim().toLowerCase(),
                password: md5(password)
            })
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                const jwt = responseData.data.token as string
                localStorage.setItem('USER_JWT', jwt)
                user.value = getJWTPayload(jwt)
                token.value = jwt
                isAuthenticated.value = true
            }
            return response.data as ResponseData
        } catch (error) {
            console.log('[UseUserStore/Signin]:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    const signup = async (payload: SignupPayload) => {
        try {
            const { email, password, nickname } = payload
            const response = await $axios.post('/signup', {
                email: email.trim().toLowerCase(),
                password: md5(password),
                nickname: nickname ? nickname.trim() : undefined
            })
            return response.data as ResponseData
        } catch (error) {
            console.log('[UseUserStore/Signup]:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    const checkin = async () => {
        try {
            const jwt = localStorage.getItem('USER_JWT') || ''
            const response = await $axios.get('/checkin' + `?jwt=${jwt}`)
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                const jwt = responseData.data.token as string
                localStorage.setItem('USER_JWT', jwt)
                user.value = getJWTPayload(jwt)
                token.value = jwt
                isAuthenticated.value = true
            }
            return response.data as ResponseData
        } catch (error) {
            console.log('[UseUserStore/Checkin]:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    const signout = async () => {
        try {
            const jwt = localStorage.getItem('USER_JWT') || ''
            const response = await $axios.get('/signout' + `?jwt=${jwt}`)
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                localStorage.removeItem('USER_JWT')
                user.value = undefined
                token.value = undefined
                isAuthenticated.value = false
            }
            return response.data as ResponseData
        } catch (error) {
            console.log('[UseUserStore/Signout]:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    return { user, token, isAuthenticated, signin, signup, checkin, signout }
})
