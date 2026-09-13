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
import { recordShellError } from '@/error-observability'
import { checkOfflineEntryPrerequisites } from '@/views/auth/offline-prerequisites'

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
// C-34：凭证类失败由结构化字段判定（不再用文案正则；文案变更不影响按钮可用性）
const credentialFailure = ref(false)
// C-29：四条件预检不通过时的显式出口提示（不静默回落）
const offlineBlocked = ref(false)

/**
 * 凭证类失败（C-06/C-23/C-34）：会话失效 ⇒ 主按钮语义切「重新登录」，
 * 且**不得提供「离线进入」**（用无效凭证进壳属安全绕过）
 */
const isCredentialFailure = computed(() => credentialFailure.value)

/**
 * 执行初始同步（先拉后推，单运行边界）
 * @description 总函数（C-26）：成功/失败/异常/悬挂均进显式终态；成败以运行返回值判定；
 *              失败展示 `lastError`（文案家族见 C-12，禁拼异常/URL）；
 *              意外异常（含 start() reject）必须落 `failed` 终态并走 C-27 打点，
 *              **禁止 `syncing` 永久 true**；成功路径保持 loading（F-5）。
 */
const runSync = async () => {
    syncing.value = true
    failed.value = false
    errorMessage.value = ''
    credentialFailure.value = false
    offlineBlocked.value = false
    try {
        const result = await syncService.start()
        if (result.ok) {
            // F-5：不置 syncing=false —— 保持 loading 至父级卸载，杜绝空渲染帧
            emit('synced')
            return
        }
        failed.value = true
        // C-34：以运行结果的结构化字段判定凭证类失败
        credentialFailure.value = result.credentialFailure === true
        errorMessage.value = result.lastError ?? ''
    } catch (err) {
        // 意外异常（B-02）：中性文案 + 结构化记录，不因异常停在 syncing
        recordShellError('sync-gate:start', err)
        failed.value = true
        errorMessage.value = t('common.loadFailed')
    } finally {
        // 成功路径保持 loading；失败/异常必须退出 loading（有限时间达终态）
        if (failed.value) syncing.value = false
    }
}

void runSync()

/**
 * 离线进入：以本地数据继续（D-1/D-3）
 * @description 仅 emit 意图（B-1：路由跳转唯一点 = AppRoot，gate 不得 import router）。
 *              C-29：点击后先预检四条件；不满足⇒显式文案 + 动作（重试/重新登录），
 *              原因码入结构化日志（无 PII），**不得静默回落**。
 */
const onEnterOffline = () => {
    const prerequisites = checkOfflineEntryPrerequisites()
    if (!prerequisites.ok) {
        offlineBlocked.value = true
        recordShellError('sync-gate:offline-prerequisites', `原因码=${prerequisites.reason}`)
        return
    }
    offlineBlocked.value = false
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
                    <!-- C-29：四条件预检不通过的显式出口（不静默回落） -->
                    <nue-text
                        v-if="offlineBlocked"
                        size="var(--nue-text-xs)"
                        class="offline-blocked"
                    >
                        {{ t('gate.offlineUnavailable') }}
                    </nue-text>
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