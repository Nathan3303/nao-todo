<script setup lang="ts">
import { cryptoService, localSession, resolveUserIdFromStoredJwt } from '@nao-todo/infrastructure'
import { onMounted, ref } from 'vue'

defineOptions({ name: 'UnlockGate' })

const emit = defineEmits<{ (e: 'unlocked'): void }>()

const checking = ref(true)
const password = ref('')
const error = ref('')
const unlocking = ref(false)
const userId = ref<string | null>(null)

onMounted(async () => {
    // 从已保存的 JWT 解析当前用户；未登录（无 JWT）直接放行到登录页
    const currentUserId = resolveUserIdFromStoredJwt()
    if (!currentUserId) {
        checking.value = false
        emit('unlocked')
        return
    }
    localSession.setCurrentUserId(currentUserId)
    userId.value = currentUserId
    // 无密钥包 = 该用户首次使用，直接放行（首次登录时由 signIn 建立密钥包）
    const hasBundle = await cryptoService.hasKeyBundle(currentUserId)
    checking.value = false
    if (!hasBundle) emit('unlocked')
})

const onUnlock = async () => {
    if (!password.value) {
        error.value = '请输入密码'
        return
    }
    if (!userId.value) {
        error.value = '无法识别当前用户，请重新登录'
        return
    }
    unlocking.value = true
    error.value = ''
    try {
        await cryptoService.unlock(userId.value, password.value)
        emit('unlocked')
    } catch {
        error.value = '密码错误，无法解锁本地数据'
    } finally {
        unlocking.value = false
    }
}
</script>

<template>
    <nue-container class="unlock-gate" theme="unlock-gate">
        <template v-if="checking">
            <nue-main>
                <nue-div align="center" gap="0.75rem" vertical>
                    <nue-icon name="loading" spin size="1.5rem" />
                    <nue-text color="gray" size="0.875rem">正在检查本地数据…</nue-text>
                </nue-div>
            </nue-main>
        </template>
        <template v-else>
            <nue-header>
                <nue-div align="center" gap="0.5rem" vertical>
                    <nue-text size="1.725rem" weight="bold">NaoTodo</nue-text>
                    <nue-text color="gray" size="0.875rem">输入密码解锁本地数据</nue-text>
                </nue-div>
            </nue-header>
            <nue-main>
                <nue-content @keydown.enter="onUnlock">
                    <form autocomplete="off" name="NaoTodoUnlockForm">
                        <nue-div vertical>
                            <nue-input
                                v-model="password"
                                :disabled="unlocking"
                                allow-show-password
                                placeholder="本地数据密码"
                                type="password"
                            />
                            <nue-button
                                :loading="unlocking"
                                :disabled="unlocking"
                                theme="primary"
                                type="submit"
                                @click="onUnlock"
                            >
                                解锁
                            </nue-button>
                        </nue-div>
                    </form>
                </nue-content>
            </nue-main>
            <nue-footer>
                <nue-text align="center" size="0.875rem" color="red">{{ error }}</nue-text>
            </nue-footer>
        </template>
    </nue-container>
</template>

<style scoped>
.nue-container--unlock-gate {
    align-items: center;
    justify-content: center;
    gap: var(--nue-gap-md);
    width: 20rem;
    height: 100vh;
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
        min-height: 1.25rem;
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
    }
}
</style>