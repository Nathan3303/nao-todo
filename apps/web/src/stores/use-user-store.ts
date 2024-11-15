import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { defineStore } from 'pinia'
import { signin, signup, checkin, signout } from '@nao-todo/apis'
import { getJWTPayload } from '@nao-todo/utils'
import { NueConfirm, NueMessage } from 'nue-ui'
import type { User, SigninOptions, SignupOptions } from '@nao-todo/types'

export const useUserStore = defineStore('userStore', () => {
    const router = useRouter()

    const user = ref<User>()
    const token = ref<string>()
    const isAuthenticated = ref(false)

    const doSignin = async (options: SigninOptions) => {
        const result = await signin(options)
        if (result.code !== 20000) return false
        const jwt = (result.data as { token: string }).token
        localStorage.setItem('USER_JWT', jwt)
        user.value = getJWTPayload(jwt)
        token.value = jwt
        isAuthenticated.value = true
        return true
    }

    const doSignup = async (options: SignupOptions) => {
        const result = await signup(options)
        return result.code === 20000
    }

    const doCheckin = async () => {
        const jwt = localStorage.getItem('USER_JWT') || ''
        const result = await checkin(jwt)
        if (result.code !== 20000) {
            localStorage.removeItem('USER_JWT')
            user.value = undefined
            token.value = undefined
            isAuthenticated.value = false
            return false
        }
        const newJWT = (result.data as { token: string }).token
        localStorage.setItem('USER_JWT', newJWT)
        user.value = getJWTPayload(newJWT)
        token.value = newJWT
        isAuthenticated.value = true
        return true
    }

    const doSignout = async () => {
        if (token.value) {
            const response = await signout(token.value)
            if (response.code !== 20000) return false
        }
        localStorage.removeItem('USER_JWT')
        user.value = undefined
        token.value = undefined
        isAuthenticated.value = false
        return true
    }

    // 用户登出（带确认）
    const signOutWithConfirmation = async () => {
        try {
            await NueConfirm({
                title: '退出登录',
                content: '你确定要退出登录吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const result = await doSignout()
            if (result) {
                NueMessage.success('退出登录成功')
                router.push('/auth/login')
                return true
            } else {
                NueMessage.error('退出登录失败')
            }
        } catch (err) {
            console.log('[UserStore] signOutWithConfirmation:', err)
        }
        return false
    }

    return {
        user,
        token,
        isAuthenticated,
        doSignin,
        doSignup,
        doCheckin,
        doSignout,
        signOutWithConfirmation
    }
})
