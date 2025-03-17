import { computed, ref, onMounted } from 'vue'
import { useUserStore, useViewStore } from '@/stores'
import { useRouter } from 'vue-router'
import type { SigninOptions, SignupOptions } from '@nao-todo/types'
import { AuthSignIn, AuthSignUp } from './components'

export type AuthViewProps = { operation?: string }

export default (props: AuthViewProps) => {
    const userStore = useUserStore()
    const viewStore = useViewStore()
    const router = useRouter()
    const loading = ref(false)

    const isLogin = computed(() => props.operation === 'login')
    const switchButtonText = computed(() => (isLogin.value ? '注册' : '登录'))
    const subView = computed(() => (isLogin.value ? AuthSignIn : AuthSignUp))
    const switchRoute = computed(() => '/auth' + (isLogin.value ? '/signup' : '/login'))

    const handleSignIn = async (options: SigninOptions) => {
        const signinRes = await userStore.doSignin(options)
        if (!signinRes) return
        await router.push({ path: '/tasks/today' })
    }

    const handleSignUp = async (options: SignupOptions) => {
        const signupRes = await userStore.doSignup(options)
        if (!signupRes) return
        await router.push({ path: '/auth/login' })
    }

    const handleSubmit = async (options: SigninOptions | SignupOptions) => {
        try {
            loading.value = true
            if (isLogin.value) {
                await handleSignIn(options as SigninOptions)
            } else {
                await handleSignUp(options as SignupOptions)
            }
        } catch (e) {
            console.log('[auth-view/handle-submit]', e)
        } finally {
            loading.value = false
        }
    }

    onMounted(() => setTimeout(viewStore.hideFirstLoadingScreen))

    return {
        userStore,
        loading,
        switchButtonText,
        subView,
        switchRoute,
        handleSubmit
    }
}
