<script setup lang="ts">
/**
 * 初始同步门
 * @description 用户解锁进入应用时执行一次同步：同步中展示 LoadingError 加载态，
 *              失败展示错误信息 + 重试按钮；成功后 emit('synced') 进入主界面。
 */
import { ref } from 'vue'
import { LoadingError } from '@nao-todo/shared'
import { syncService, syncStatus } from '@nao-todo/infrastructure'

defineOptions({ name: 'InitialSyncGate' })

const emit = defineEmits<{ (event: 'synced'): void }>()

const syncing = ref(true)
const failed = ref(false)
const errorMessage = ref('')

/**
 * 执行初始同步（先拉后推）
 * @description 成败以 syncStatus.lastError 判定（start 内部 catch 后不抛错，但会写入 lastError）
 */
const runSync = async () => {
    syncing.value = true
    failed.value = false
    errorMessage.value = ''
    // 清空上次错误标记，避免残留 lastError 误判
    syncStatus.markSyncing()
    await syncService.start()
    const lastError = syncStatus.get().lastError
    if (lastError) {
        failed.value = true
        errorMessage.value = lastError
        syncing.value = false
        return
    }
    syncing.value = false
    emit('synced')
}

runSync()
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
                    <nue-button theme="primary" @click="runSync">重试</nue-button>
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