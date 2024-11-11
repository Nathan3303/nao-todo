import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores'
import { NueConfirm } from 'nue-ui'

// 用户登出（待确认）
export const signoutWithComfirmation = async () => {
    try {
        const router = useRouter()
        const userStore = useUserStore()
        await NueConfirm({
            title: '退出登录',
            content: '确认退出当前账户吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        const response = await userStore.signout()
        if (response.code === 20000) {
            router.push('/authentication/login')
            return true
        }
        throw new Error(response.message)
    } catch (err) {
        console.log('[Handlers/Auth] signoutWithComfirmation:', err)
        return false
    }
}
