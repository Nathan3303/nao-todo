<template>
    <nue-container id="AuthViewMainContentSignUp">
        <nue-header>
            <nue-div align="center" gap="0.5rem" vertical>
                <nue-text size="1.725rem" weight="bold">创建您的 NaoTodo 账户</nue-text>
                <nue-text align="center" color="grey" size="0.875rem">
                    在下面输入您的电子邮件和密码以创建账户
                </nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content @keydown.enter="handleSubmit">
                <form autocomplete="off" name="NaoTodoSignUpForm">
                    <nue-div vertical>
                        <nue-input
                            v-model="signUpVO.email"
                            :disabled="loading"
                            clearable
                            name="SignUpEmail"
                            placeholder="电子邮箱 (name@example.com)"
                            type="email"
                        />
                        <password-rule-hint />
                        <nue-input
                            v-model="signUpVO.password"
                            :disabled="loading"
                            allow-show-password
                            clearable
                            placeholder="密码"
                            type="password"
                        />
                        <nue-input
                            v-model="signUpVO.passwordConfirm"
                            :disabled="loading"
                            allow-show-password
                            clearable
                            placeholder="确认密码"
                            type="password"
                        />
                        <nue-input
                            v-model="signUpVO.nickname"
                            :disabled="loading"
                            placeholder="昵称（留空系统自动生成）"
                        />
                        <nue-button
                            :loading="loading"
                            theme="primary"
                            type="submit"
                            @click="handleSubmit"
                        >
                            注册
                        </nue-button>
                    </nue-div>
                </form>
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-text align="center" color="gray" size="12px">
                点击注册按钮后，即表示您同意我们站点的<br />
                <nue-link>服务条款</nue-link>
                和
                <nue-link>隐私政策</nue-link>
            </nue-text>
            <nue-divider />
            <nue-text align="center" color="gray" size="12px">
                已经拥有 NaoTodo 账号了吗？现在就去
                <nue-link route="/auth/signin">登录</nue-link>
                吧
            </nue-text>
        </nue-footer>
    </nue-container>
</template>

<script lang="ts" setup>
import { inject, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PasswordRuleHint } from '@nao-todo/components'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { AUTH_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AuthViewContext } from '@/views/auth/types'

const router = useRouter()
const { authUseCase } = inject<AuthViewContext>(AUTH_VIEW_CONTEXT_KEY)!

const loading = ref(false)
const disabled = ref(false)
const signUpVO = reactive({ email: '', password: '', passwordConfirm: '', nickname: '' })

const handleSubmit = async (e: Event) => {
    e.preventDefault()
    loading.value = disabled.value = true
    // 调用注册 API
    const err = await authUseCase.signUp({
        email: signUpVO.email,
        password: signUpVO.password,
        confirmPassword: signUpVO.passwordConfirm,
        nickname: signUpVO.nickname
    })
    loading.value = false
    // 处理错误
    if (err !== null) {
        signUpVO.password = signUpVO.passwordConfirm = ''
        disabled.value = false
        NueMessage.error(unwrapError(err))
        return
    }
    // 注册成功，跳转到登录页
    NueMessage.success('注册成功')
    await router.push({ path: '/auth/signin' })
}
</script>

<style scoped>
#AuthViewMainContentSignUp {
    align-items: center;
    justify-content: center;
    gap: 1.75rem;

    > .nue-header {
        border: none;
        width: 20rem;
        align-items: center;
        justify-content: center;
        height: auto;
    }

    > .nue-main {
        width: 20rem;
        border: none;
        height: auto;
        align-items: center;
        justify-content: center;
        flex: none;
    }

    > .nue-footer {
        flex-direction: column;
        border: none;
        width: 20rem;
        align-items: center;
        justify-content: center;
        height: auto;
    }
}
</style>

