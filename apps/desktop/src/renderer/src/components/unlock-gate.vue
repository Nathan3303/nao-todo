<script setup lang="ts">
import {
    cryptoService,
    deletionService,
    localSession,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure'
import { useUserStore } from '@nao-todo/presentation-identity'
import { useUserUseCase } from '@/hooks'
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getAvatarSrc, Loading as LoadingComp } from '@nao-todo/shared'
import { NueConfirm } from 'nue-ui'

defineOptions({ name: 'UnlockGate' })

const emit = defineEmits<{ (e: 'unlocked'): void }>()

const userStore = useUserStore()

const checking = ref(true)
const password = ref('')
const error = ref('')
const unlocking = ref(false)
const userId = ref<string | null>(null)
const { profile, userToken } = storeToRefs(userStore)

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
    // 注销反悔期到期：清空该用户本地数据（密钥包一并删除，按全新用户放行）
    await deletionService.checkAndCleanExpired(currentUserId)
    // 无密钥包 = 该用户首次使用，直接放行（首次登录时由 signIn 建立密钥包）
    const hasBundle = await cryptoService.hasKeyBundle(currentUserId)
    checking.value = false
    if (!hasBundle) {
        emit('unlocked')
        return
    }
    // 拉取当前用户资料（头像/昵称/邮箱）；失败不阻塞解锁
    try {
        await useUserUseCase(userStore).loadUserProfile()
    } catch (loadErr) {
        console.warn('[desktop] 解锁界面加载用户资料失败', loadErr)
    }
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

/**
 * 登出当前用户：清 JWT/本地会话/内存密钥，放行后由 App 引导至登录页
 */
const onSignOut = () => {
    NueConfirm({
        title: '确认登出吗？',
        content: '登出后将清除本次会话密钥，需重新登录才能访问本地数据。',
        confirmButtonText: '登出',
        cancelButtonText: '取消',
        onConfirm: () => {
            userStore.clearAuthData()
            localSession.clear()
            cryptoService.lock()
            emit('unlocked')
        }
    })
}
</script>

<template>
    <nue-container class="unlock-gate" theme="unlock-gate">
        <template v-if="checking">
            <loading-comp placeholder="正在检查本地数据 ..." />
        </template>
        <template v-else-if="profile">
            <nue-header>
                <nue-div align="center" gap="0.5rem" vertical>
                    <nue-avatar
                        :src="getAvatarSrc(profile.avatar || '', userToken)"
                        icon="user"
                        size="4rem"
                        alt="用户头像"
                    />
                    <nue-text weight="bold" size="1.25rem">{{ profile.nickname }}</nue-text>
                    <nue-text color="gray" size="0.875rem">{{ profile.email }}</nue-text>
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
                                placeholder="输入密码解锁"
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
                            <nue-button
                                :disabled="unlocking"
                                size="small"
                                theme="pure"
                                @click="onSignOut"
                            >
                                登出用户
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

        .nue-button--pure {
            margin: 0 auto;
        }
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