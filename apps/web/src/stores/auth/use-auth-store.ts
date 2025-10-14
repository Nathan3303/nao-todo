import { defineStore } from 'pinia'
import { ref } from 'vue'
import { NueMessage } from 'nue-ui'
import {
    useUserStoreV2,
    useTodoStore,
    useProjectStore,
    useTagStore,
    useEventStore,
    useCommentStore
} from '@/stores/global'
import { unwrapError } from '@nao-todo/utils'
import type { Err } from '@nao-todo/types'

const useAuthStore = defineStore('AuthStore', () => {
    // @stores 全局 stores
    const userStore = useUserStoreV2()
    const todoStore = useTodoStore()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const eventStore = useEventStore()
    const commentStore = useCommentStore()

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

    // @method 处理登出
    const handleSignout = async (): Promise<Err> => {
        // 登出
        const err = await userStore.signoutAndRedirect()
        // 处理失败结果
        if (err) {
            NueMessage.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        NueMessage.success('登出成功')
        // 清除用户数据
        todoStore.__resetStates()
        projectStore.__resetStates()
        tagStore.__resetStates()
        eventStore.__resetStates()
        commentStore.__resetStates()
        // 返回结果
        return null
    }

    // @returns
    return {
        loading,
        handleSignIn,
        handleSignUp,
        handleSignoutAndRedirect: handleSignout
    }
})

export default useAuthStore
