<template>
    <nue-container class="authentication-view">
        <nue-main aside-width="45%" :allow-resize-aside="false">
            <template #aside>
                <nue-div vertical justify="space-between" flex>
                    <nue-div align="center">
                        <nue-text size="32px" color="white">NaoTodo</nue-text>
                    </nue-div>
                    <nue-text size="16px" color="white">
                        使用专门为您量身定制的智能待办事项列表应用程序NaoTodo，
                        探索高效生活的新方式。无论是工作、学习还是日常生活，
                        NaoTodo都能帮助您轻松管理任务，提高生产力。
                        凭借其直观的界面和强大的功能，您可以毫不费力地添加、
                        编辑和跟踪任务、设置提醒，并且永远不会错过重要的细节。
                    </nue-text>
                </nue-div>
            </template>
            <template #content>
                <nue-div vertical height="100%" align="center" gap="0px">
                    <nue-div align="center" justify="end" height="0px">
                        <nue-button @click="$router.push(switchRoute)">
                            {{ switchButtonText }}
                        </nue-button>
                    </nue-div>
                    <component :is="subView" @submit="handleSubmit" :loading="loading" />
                </nue-div>
            </template>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AuthSignIn, AuthSignUp } from '@/layers'
import { useUserStore } from '@/stores/use-user-store'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import type { SigninOptions, SignupOptions } from '@nao-todo/types'

const props = defineProps<{
    operation?: string
}>()

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)

const isLogin = computed(() => props.operation === 'login')
const switchButtonText = computed(() => (isLogin.value ? '注册' : '登录'))
const subView = computed(() => (isLogin.value ? AuthSignIn : AuthSignUp))
const switchRoute = computed(() => '/auth' + (isLogin.value ? '/signup' : '/login'))

const handleSignin = async (options: SigninOptions) => {
    const res = await userStore.doSignin(options)
    if (!res) throw new Error('登录失败')
    await router.push({ name: 'index' })
    requestIdleCallback(() => NueMessage.success('登录成功'))
}

const handleSignup = async (payload: SignupOptions) => {
    const res = await userStore.doSignup(payload)
    if (!res) throw new Error('注册失败')
    await router.push('/auth/login')
    requestIdleCallback(() => NueMessage.success('注册成功'))
}

async function handleSubmit(payload: SigninOptions | SignupOptions) {
    loading.value = true
    try {
        if (isLogin.value) {
            await handleSignin(payload as SigninOptions)
        } else {
            await handleSignup(payload as SignupOptions)
        }
    } catch (e) {
        if (e instanceof Error) {
            NueMessage.error(e.message)
            return
        }
        console.log('[/auth/index.vue]:handleSubmit', e)
    } finally {
        loading.value = false
    }
}
</script>

<style>
.authentication-view {
    .nue-main {
        .nue-main__aside {
            background-color: #18181b;
            padding: 32px;
        }
    }
}

@media screen and (max-width: 768px) {
    .authentication-view {
        .nue-main {
            .nue-main__aside {
                display: none;
            }
        }
    }
}
</style>
