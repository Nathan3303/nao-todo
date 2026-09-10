<script setup lang="ts">
/**
 * 初始同步门 —— SHELL-03 终态完备化
 * @description 总函数：任何路径都必须进入且仅进入一个显式终态 ∈ {syncing, failed, ready}
 *              （C-01/C-13）。成败以 `syncService.start()` 的**运行返回值**判定（C-10/R4：
 *              不再读全局 `lastError`、不再调 `markSyncing`）。失败终态恒含
 *              「重试」+「离线进入」+「登出/重新登录」（C-02/C-06），消除"离线时重试是死路"。
 *              成功路径**不置 `syncing = false`**（F-5：保持 loading 至父级卸载，消除
 *              `loading=false && error=false` 的空渲染帧）。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */
import { computed, ref } from 'vue'
import { LoadingError, t } from '@nao-todo/shared'
import { cryptoService, localSession, syncService } from '@nao-todo/infrastructure'
import { useUserStore } from '@nao-todo/presentation-identity'

defineOptions({ name: 'InitialSyncGate' })

/**
 * @emits synced 同步成功（门通过，路由由来路决定）
 * @emits offline 用户显式选择「离线进入」（**只表达意图**；路由跳转归 AppRoot，见 ADR 附录 B-1）
 * @emits signOut 用户选择登出/重新登录（同样由 AppRoot 显式跳转）
 */
const emit = defineEmits<{
    (e: 'synced'): void
    (e: 'offline'): void
    (e: 'signOut'): void
}>()

const userStore = useUserStore()

const syncing = ref(true)
const failed = ref(false)
const errorMessage = ref('')

/**
 * 凭证类失败（C-06/C-23）：会话失效 ⇒ 主按钮语义切「重新登录」，
 * 且**不得提供「离线进入」**（用无效凭证进壳属安全绕过）
 */
const isCredentialFailure = computed(() => /登录已过期|401|403/.test(errorMessage.value))

/**
 * 执行初始同步（先拉后推，单运行边界）
 * @description 成败以运行返回值判定；失败展示 `lastError`（文案家族见 C-12，禁拼异常/URL）
 */
const runSync = async () => {
    syncing.value = true
    failed.value = false
    errorMessage.value = ''
    const result = await syncService.start()
    if (result.ok) {
        // F-5：不置 syncing=false —— 保持 loading 至父级卸载，杜绝空渲染帧
        emit('synced')
        return
    }
    failed.value = true
    errorMessage.value = result.lastError ?? ''
    syncing.value = false
}

runSync()

/**
 * 离线进入：以本地数据继续（D-1/D-3）
 * @description 仅 emit 意图（B-1：路由跳转唯一点 = AppRoot，gate 不得 import router）
 */
const onEnterOffline = () => {
    emit('offline')
}

/** 登出 / 重新登录：清 JWT + 本地会话 + 内存密钥（本地业务数据保留），意图交 AppRoot 显式跳转 */
const onSignOut = () => {
    userStore.clearAuthData()
    localSession.clear()
    cryptoService.lock()
    emit('signOut')
}
</script>

<template>
    <nue-main class="initial-sync-gate">
        <LoadingError
            :loading="syncing"
            loading-message="正在同步数据…"
            :error="failed"
            :error-message="errorMessage"
        >
            <template #error>
                <nue-div align="center" gap="0.75rem" vertical>
                    <nue-text size="var(--nue-text-sm)">{{ errorMessage }}</nue-text>
                    <nue-button theme="primary" @click="runSync">重试</nue-button>
                    <!-- C-23：凭证类失败不得提供「离线进入」（隐藏，避免死按钮） -->
                    <nue-button
                        v-if="!isCredentialFailure"
                        theme="secondary"
                        @click="onEnterOffline"
                    >
                        {{ t('gate.enterOffline') }}
                    </nue-button>
                    <nue-button size="small" theme="pure" @click="onSignOut">
                        {{ isCredentialFailure ? t('gate.signInAgain') : '登出用户' }}
                    </nue-button>
                </nue-div>
            </template>
        </LoadingError>
    </nue-main>
</template>

<style scoped>
.initial-sync-gate {
    height: 100vh;
    width: 100%;
}
</style>