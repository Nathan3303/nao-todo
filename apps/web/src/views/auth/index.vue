<template>
    <nue-container class="authentication-view">
        <nue-main :allow-resize-aside="false" aside-width="45%">
            <template #aside>
                <nue-div flex justify="space-between" vertical>
                    <nue-div align="center">
                        <nue-text color="white" size="32px">NaoTodo</nue-text>
                    </nue-div>
                    <nue-text color="white" size="16px">
                        使用专门为您量身定制的智能待办事项列表应用程序 NaoTodo，
                        探索高效生活的新方式。无论是工作、学习还是日常生活， NaoTodo
                        都能帮助您轻松管理任务，提高生产力。
                        凭借其直观的界面和强大的功能，您可以毫不费力地添加、
                        编辑和跟踪任务、设置提醒，并且永远不会错过重要的细节。
                    </nue-text>
                </nue-div>
            </template>
            <template #content>
                <nue-div align="center" gap="0px" height="100%" vertical>
                    <nue-div align="center" height="0px" justify="end">
                        <nue-button @click="$router.push(switchRoute)">
                            {{ switchButtonText }}
                        </nue-button>
                    </nue-div>
                    <component :is="subView" :loading="loading" @submit="handleSubmit" />
                </nue-div>
            </template>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
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
    if (!res) return false
    await router.push({ name: 'index' })
}

const handleSignup = async (payload: SignupOptions) => {
    const res = await userStore.doSignup(payload)
    if (!res) return false
    await router.push('/auth/login')
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
