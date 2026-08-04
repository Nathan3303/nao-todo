<script setup lang="ts">
import { cryptoService } from '@nao-todo/infrastructure'
import { onMounted, ref } from 'vue'

defineOptions({ name: 'UnlockGate' })

const emit = defineEmits<{ (e: 'unlocked'): void }>()

const checking = ref(true)
const password = ref('')
const error = ref('')
const unlocking = ref(false)

onMounted(async () => {
    // 无密钥包 = 全新用户，直接放行（首次登录时由 signIn 建立密钥包）
    const hasBundle = await cryptoService.hasKeyBundle()
    checking.value = false
    if (!hasBundle) emit('unlocked')
})

const onUnlock = async () => {
    if (!password.value) {
        error.value = '请输入密码'
        return
    }
    unlocking.value = true
    error.value = ''
    try {
        await cryptoService.unlock(password.value)
        emit('unlocked')
    } catch {
        error.value = '密码错误，无法解锁本地数据'
    } finally {
        unlocking.value = false
    }
}
</script>

<template>
    <div class="unlock-gate">
        <template v-if="checking">
            <nue-text>正在检查本地数据…</nue-text>
        </template>
        <template v-else>
            <nue-text class="title" size="2rem" color="var(--nue-primary-color-0)"
                >NaoTodo</nue-text
            >
            <nue-text class="subtitle" size="1rem">输入密码解锁本地数据</nue-text>
            <input
                v-model="password"
                class="password-input"
                type="password"
                placeholder="本地数据密码"
                @keyup.enter="onUnlock"
            />
            <nue-button theme="primary" :loading="unlocking" @click="onUnlock">解锁</nue-button>
            <nue-text v-if="error" class="error" size="0.875rem" color="red">{{ error }}</nue-text>
        </template>
    </div>
</template>

<style scoped>
.unlock-gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    height: 100vh;
    background-color: var(--nue-primary-color-900);
}
.unlock-gate .title {
    font-weight: 600;
}
.unlock-gate .subtitle {
    opacity: 0.85;
    margin-bottom: 0.5rem;
}
.password-input {
    width: 260px;
    padding: 0.625rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--nue-border-color);
    background-color: var(--nue-background-color);
    color: var(--nue-text-color);
    font-size: 1rem;
    outline: none;
}
.password-input:focus {
    border-color: var(--nue-primary-color);
}
.unlock-gate .error {
    min-height: 1.25rem;
}
</style>