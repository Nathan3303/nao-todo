/**
 * 手动同步 hook
 * @description 手动触发完整同步（拉取全部 + 推送全部），返回执行状态供 UI 反馈。
 */
import { ref } from 'vue'
import { syncService } from '@nao-todo/infrastructure'

export const useManualSync = () => {
    const syncing = ref(false)

    const run = async (): Promise<string | null> => {
        if (syncing.value) return '同步进行中，请稍候'
        syncing.value = true
        try {
            await syncService.manualSync()
            return null
        } catch (err) {
            return `同步失败：${String(err)}`
        } finally {
            syncing.value = false
        }
    }

    return { syncing, run }
}