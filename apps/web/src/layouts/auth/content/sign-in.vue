<template>
    <nue-container theme="sign-in">
        <nue-header>
            <nue-div align="center" gap="0.5rem" vertical>
                <nue-text size="1.725rem" weight="bold">登录到 NaoTodo</nue-text>
                <nue-text color="gray" size="0.875rem">使用您的电子邮件和密码进行登录</nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content @keydown.enter="handleSubmit">
                <form autocomplete="off" name="NaoTodoSignInForm">
                    <nue-div vertical>
                        <nue-input
                            v-model="signInVO.email"
                            :disabled="loading || disabled"
                            placeholder="电子邮箱 (name@example.com)"
                            type="email"
                        />
                        <nue-input
                            v-model="signInVO.password"
                            :disabled="loading || disabled"
                            allow-show-password
                            placeholder="密码"
                            type="password"
                        />
                        <nue-button
                            :loading="loading"
                            :disabled="disabled"
                            theme="primary"
                            type="submit"
                            @click="handleSubmit"
                        >
                            登录
                        </nue-button>
                    </nue-div>
                </form>
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-text align="center">
                还没有 NaoTodo 账号吗？去
                <nue-link route="/auth/signup">注册</nue-link>
                一个！
            </nue-text>
        </nue-footer>
    </nue-container>
</template>

<script lang="ts" setup>
import { inject, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { NueMessage } from 'nue-ui'
import { AUTH_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AuthViewContext } from '@/views/auth/types'
import type { SignInViewObject } from '@nao-todo/types'

defineOptions({ name: 'AuthViewMainContentSignIn' })

const router = useRouter()
const { authUseCase } = inject<AuthViewContext>(AUTH_VIEW_CONTEXT_KEY)!

const loading = ref(false)
const disabled = ref(false)
const signInVO = reactive<SignInViewObject>({ email: '', password: '' })

const handleSubmit = async (e: Event) => {
    e.preventDefault()
    loading.value = disabled.value = true
    const err = await authUseCase.signIn(signInVO)
    if (err !== null) {
        signInVO.password = ''
        loading.value = disabled.value = false
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success('登录成功')
    await router.push({ path: '/tasks' })
}
</script>

<style scoped>
.nue-container--sign-in {
    align-items: center;
    justify-content: center;
    gap: var(--nue-gap-md);
    width: 20rem;
    margin: 0 auto;

    > .nue-header {
        border: none;
        align-items: center;
        justify-content: center;
        height: auto;
    }

    > .nue-main {
        border: none;
        height: auto;
        align-items: center;
        justify-content: center;
        flex: none;
    }

    > .nue-footer {
        flex-direction: column;
        border: none;
        align-items: center;
        justify-content: center;
        height: auto;
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
    }
}
</style>

