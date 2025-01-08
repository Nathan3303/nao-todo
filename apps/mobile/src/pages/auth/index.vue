<template>
    <wd-notify />
    <view class="auth-view mp-view">
        <auth-sign-in :loading="loading" @submit="handleSubmit" />
    </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import AuthSignIn from './sign-in.vue'
import { useNotify } from 'wot-design-uni'
import { useAuthStore } from './store'
import type { SigninOptions } from '@nao-todo/types'

const authStore = useAuthStore()

const { showNotify } = useNotify()
const loading = ref(false)

const handleSignin = async (options: SigninOptions) => {
    const res = await authStore.signin(options)
    if (res.code !== 20000) {
        showNotify({ type: 'danger', message: '登录失败：' + res.message, position: 'bottom' })
        return
    }
    showNotify({ type: 'success', message: '登录成功', position: 'bottom' })
    setTimeout(() => {
        uni.switchTab({
            url: '/pages/tasks/index',
            animationType: 'pop-out',
            animationDuration: 200
        })
    }, 1024)
}

async function handleSubmit(payload: SigninOptions) {
    loading.value = true
    try {
        await handleSignin(payload as SigninOptions)
    } catch (e) {
        if (e instanceof Error) {
            showNotify({ type: 'danger', message: e.message, position: 'bottom' })
            return
        }
        console.log('[/auth/index.vue]:handleSubmit', e)
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.auth-view {
    justify-content: center;
    padding-bottom: 4rem;
}
</style>
