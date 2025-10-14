import { defineStore } from 'pinia'
import { ref } from 'vue'
import { NueMessage } from 'nue-ui'
import { useUserStoreV2 } from '@/stores/global'
import { unwrapError } from '@nao-todo/utils'
import type { Err } from '@nao-todo/types'

const useAuthStore = defineStore('AuthStore', () => {
    // @stores 全局 stores
    const userStore = useUserStoreV2()

    // @state 登录状态（加载态）
    const loading = ref(false)

    // @method 处理登录
    const handleSignIn = async (email: string, password: string): Promise<Err> => {
        const err = await userStore.signin({ email, password })
        if (err) {
            NueMessage.error(unwrapError(err))
            return err
        }
        NueMessage.success('登录成功')
        return null
    }

    // @method 处理注册
    const handleSignUp = async (
        email: string,
        password: string,
        passwordConfirm: string,
        nickname: string
    ): Promise<Err> => {
        if (password !== passwordConfirm) {
            const err = '两次输入的密码不一致'
            NueMessage.error(err)
            return err
        }
        const err = await userStore.signup({ email, password, nickname })
        if (err) {
            NueMessage.error(unwrapError(err))
            return err
        }
        NueMessage.success('注册成功')
        return null
    }

    // @returns
    return {
        loading,
        handleSignIn,
        handleSignUp,
        handleSignoutAndRedirect: userStore.signoutAndRedirect
    }
})

export default useAuthStore
