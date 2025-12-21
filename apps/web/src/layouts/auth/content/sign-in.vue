<template>
    <nue-container id="AuthViewMainContentSignIn">
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
            <nue-text align="center" color="gray" size="12px">
                认证成功后，您可以在接下来的 7 日期限内免密访问您的账户，直到您退出或在别处登录。
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
        </nue-footer>
    </nue-container>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import useAuthViewStore from '@/views/auth/auth-view-store'
import { unwrapError } from '@nao-todo/utils'
import { NueMessage } from 'nue-ui'
import type { SignInVO } from '@nao-todo/types'
import { onMounted } from 'vue'

defineOptions({ name: 'AuthViewMainContentSignIn' })

const authViewStore = useAuthViewStore()
const router = useRouter()

const loading = ref(false)
const disabled = ref(false)
const signInVO = reactive<SignInVO>({ email: '', password: '' })

const handleSubmit = async (e: Event) => {
    e.preventDefault()
    loading.value = disabled.value = true
    const err = await authViewStore.signIn(signInVO)
    if (err) {
        signInVO.password = ''
        loading.value = disabled.value = false
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success("登录成功")
    await router.push({ path: '/tasks' })
}

onMounted(() => {
    authViewStore.hideFirstLoadingScreen()
})
</script>

<style scoped>
#AuthViewMainContentSignIn {
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
