import { defineStore } from 'pinia'
import { ref } from 'vue'
import { NueMessage } from 'nue-ui'
import { useAxios } from '@nao-todo/hooks/use-requester'
import { useUserStoreV2 } from '@/stores/global'
import { unwrapError } from '@nao-todo/utils'

const useAuthViewStore = defineStore('AuthViewStore', () => {
    const loading = ref(false)
    const requester = useAxios('http://localhost:3303/api/user')
    const userStoreV2 = useUserStoreV2()

    const handleSignIn = async (email: string, password: string) => {
        const [res, err] = await userStoreV2.signin({ email, password }, requester)
        if (err) {
            NueMessage.error(unwrapError(err))
            return false
        }
        NueMessage.success('登录成功')
        return res
    }

    const handleSignUp = async (
        email: string,
        password: string,
        passwordConfirm: string,
        nickname: string
    ) => {
        if (password !== passwordConfirm) {
            NueMessage.error('两次输入的密码不一致')
            return false
        }
        const [res, err] = await userStoreV2.signup({ email, password, nickname }, requester)
        if (err) {
            NueMessage.error(unwrapError(err))
            return false
        }
        NueMessage.success('注册成功')
        return res
    }

    return {
        loading,
        handleSignIn,
        handleSignUp
    }
})

export { useAuthViewStore }
