<template>
    <nue-container id="AuthViewSigninContainer">
        <nue-main>
            <nue-div
                align="stretch"
                gap="1.75rem"
                vertical
                width="20rem"
                height="auto"
                @keydown.enter="handleSubmit"
            >
                <nue-div align="center" gap="0.5rem" vertical>
                    <nue-text size="1.725rem" weight="bold">登录到 NaoTodo</nue-text>
                    <nue-text color="gray" size="0.875rem">使用您的电子邮件和密码进行登录</nue-text>
                </nue-div>
                <form autocomplete="off" name="NaoTodoSignInForm">
                    <nue-div align="stretch" vertical>
                        <nue-input
                            v-model="formData.email"
                            :disabled="loading"
                            placeholder="电子邮箱 (name@example.com)"
                            type="email"
                        />
                        <nue-input
                            v-model="formData.password"
                            :disabled="loading"
                            allow-show-password
                            placeholder="密码"
                            type="password"
                        />
                        <nue-button
                            :loading="loading"
                            theme="primary"
                            type="submit"
                            @click="handleSubmit"
                        >
                            登录
                        </nue-button>
                    </nue-div>
                </form>
                <nue-div vertical align="center">
                    <nue-text align="center" color="gray" size="12px">
                        认证成功后，您可以在接下来的 7
                        日期限内免密访问您的账户，直到您退出或在别处登录。
                    </nue-text>
                    <nue-divider />
                    <nue-text align="center" color="gray" size="12px">
                        还没有 NaoTodo 账号吗？去
                        <nue-link route="/auth/signup">注册</nue-link>
                        一个吧
                    </nue-text>
                    <nue-text align="center" color="gray" size="12px">
                        忘记密码了吗？去
                        <nue-link route="/auth/signup">重置密码</nue-link>
                        吧
                    </nue-text>
                </nue-div>
            </nue-div>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useAuthViewStore } from './use-auth-view-store'
import { useRouter } from 'vue-router'

const authViewStore = useAuthViewStore()
const router = useRouter()

const loading = ref(false)
const formData = reactive({
    email: '',
    password: ''
})

const handleSubmit = async (e: Event) => {
    e.preventDefault()
    loading.value = true
    const result = await authViewStore.handleSignIn(formData.email, formData.password)
    loading.value = false
    if (!result) {
        formData.password = ''
        return
    }
    await router.push({ path: '/settings' })
}
</script>

<style scoped>
#AuthViewSigninContainer {
    > .nue-main {
        align-items: center;
        justify-content: center;
    }
}
</style>
