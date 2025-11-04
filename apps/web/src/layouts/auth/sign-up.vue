<template>
    <nue-container id="AuthViewSignupContainer">
        <nue-main>
            <nue-div
                gap="1.75rem"
                vertical
                width="20rem"
                height="auto"
                @keydown.enter="handleSubmit"
            >
                <nue-div align="center" gap="0.5rem" vertical>
                    <nue-text size="1.725rem" weight="bold">创建您的 NaoTodo 账户</nue-text>
                    <nue-text align="center" color="grey" size="0.875rem">
                        在下面输入您的电子邮件和密码以创建账户
                    </nue-text>
                </nue-div>
                <form autocomplete="off" name="NaoTodoSignUpForm">
                    <nue-div vertical>
                        <nue-input
                            v-model="formData.email"
                            :disabled="loading"
                            clearable
                            name="SignUpEmail"
                            placeholder="电子邮箱 (name@example.com)"
                            type="email"
                        />
                        <password-rule-hint />
                        <nue-input
                            v-model="formData.password"
                            :disabled="loading"
                            allow-show-password
                            clearable
                            placeholder="密码"
                            type="password"
                        />
                        <nue-input
                            v-model="formData.passwordConfirm"
                            :disabled="loading"
                            allow-show-password
                            clearable
                            placeholder="确认密码"
                            type="password"
                        />
                        <nue-input
                            v-model="formData.nickname"
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
                <nue-div vertical align="center">
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
                </nue-div>
            </nue-div>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { PasswordRuleHint } from '@/components/ui'

const authStore = useAuthStore()
const router = useRouter()

const loading = ref(false)
const disabled = ref(false)
const formData = reactive({
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: ''
})

const handleSubmit = async (e: Event) => {
    e.preventDefault()
    loading.value = true
    disabled.value = true
    // 调用注册 API
    const err = await authStore.handleSignUp(
        formData.email,
        formData.password,
        formData.passwordConfirm,
        formData.nickname
    )
    loading.value = false
    // 处理错误
    if (err) {
        formData.password = ''
        formData.passwordConfirm = ''
        disabled.value = false
        return
    }
    // 注册成功，跳转到登录页
    await router.push({ path: '/auth/signin' })
}
</script>

<style scoped>
#AuthViewSignupContainer {
    > .nue-main {
        align-items: center;
        justify-content: center;
    }
}
</style>

