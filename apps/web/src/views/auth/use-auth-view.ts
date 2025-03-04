import { ref, computed, defineAsyncComponent } from 'vue'
import { useUserStoreV2 } from '@nao-todo/stores'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import type { SigninOptions, SignupOptions } from '@nao-todo/types'

export type AuthViewProps = { operation?: string }

export default (props: AuthViewProps) => {
    const userStore = useUserStoreV2()
    const router = useRouter()
    const loading = ref(false)

    const isLogin = computed(() => {
        return props.operation === 'login'
    })

    const switchButtonText = computed(() => {
        return isLogin.value ? '注册' : '登录'
    })

    const AsyncNaoSignIn = defineAsyncComponent(() => {
        return import('@/layouts/authentication/sign-in.vue')
    })

    const AsyncNaoSignUp = defineAsyncComponent(() => {
        return import('@/layouts/authentication/sign-up.vue')
    })

    const subView = computed(() => {
        return isLogin.value ? AsyncNaoSignIn : AsyncNaoSignUp
    })

    const switchRoute = computed(() => {
        return '/auth' + (isLogin.value ? '/signup' : '/login')
    })

    const handleSignIn = async (options: SigninOptions) => {
        const result = await userStore.signIn(options)
        if (result.code !== 100) {
            NueMessage.error(result.message)
        } else {
            NueMessage.success('登录成功')
            localStorage.setItem('USER_JWT', result.payload?.token)
            await router.push({ name: 'index' })
        }
        return result
    }

    const handleSignUp = async (options: SignupOptions) => {
        const result = await userStore.signUp(options)
        if (result.code !== 110) {
            NueMessage.error(result.message)
        } else {
            NueMessage.success('注册成功')
            await router.push('/auth/login')
        }
        return result
    }

    const handleSubmit = async (options: SigninOptions | SignupOptions) => {
        loading.value = true
        try {
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

    return {
        userStore,
        loading,
        switchButtonText,
        subView,
        switchRoute,
        handleSubmit
    }
}
