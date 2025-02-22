<template>
    <view class="auth-view__container">
        <view class="auth-view__header">
            <text style="font-size: 1.5rem; font-weight: bold">登录到 NaoTodo</text>
            <text style="font-size: 0.75rem; color: gray">使用您的电子邮件和密码进行登录</text>
        </view>
        <view class="auth-view__main">
            <nuem-input
                v-model="email"
                :disabled="loading"
                placeholder="电子邮箱 (name@example.com)"
            />
            <nuem-input v-model="password" :disabled="loading" placeholder="密码" />
            <nuem-button :loading="loading" theme="pri" @click="handleSignIn"> 登录</nuem-button>
        </view>
        <view class="auth-view__footer">
            点击登录按钮并成功认证后，您可以在接下来 7
            日的期限内免密访问您的账户，直到您退出或在别处登录。
        </view>
    </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import NuemButton from '@/ui/button.vue'
import NuemInput from '@/ui/input.vue'
import { useNotify } from 'wot-design-uni'

defineOptions({ name: 'AuthSignIn' })
defineProps<{ loading?: boolean }>()
const emit = defineEmits<{
    (e: 'submit', payload: { email: string; password: string }): void
}>()

const { showNotify } = useNotify()

const email = ref('lee1928@outlook.com')
const password = ref('lianGjh3303..')

function handleSignIn() {
    if (email.value === '') {
        showNotify({ type: 'warning', message: '请输入邮箱' })
        return
    }
    if (password.value === '') {
        showNotify({ type: 'warning', message: '请输入密码' })
        return
    }
    emit('submit', { email: email.value, password: password.value })
}
</script>

<style scoped>
.auth-view__container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 1.5rem;
    width: 20rem;
}

.auth-view__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
}

.auth-view__main {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
}

.auth-view__footer {
    font-size: 0.75rem;
    color: gray;
    text-align: center;
}
</style>
