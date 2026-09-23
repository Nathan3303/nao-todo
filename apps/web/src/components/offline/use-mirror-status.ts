import { computed, onMounted, onUnmounted, ref } from 'vue'
import { syncStatus } from '@nao-todo/infrastructure'
import { useReadOnlyState } from '@nao-todo/presentation/offline'
import { getMirrorState } from '@/data-plane'

/**
 * 镜像状态（C-60 文案三分 / 覆盖度-触顶 的 UI 输入）
 * @description 订阅 `syncStatus`（含 T107b 从 `meta` 恢复的 `mirrorPulledAt`/`mirrorTruncated`），
 *              暴露离线态 + 镜像新鲜度 + 覆盖度信号；组件卸载自动退订。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-60 / C-66）
 */
export const useMirrorStatus = () => {
    const { isReadOnly } = useReadOnlyState()

    const mirror = ref(getMirrorState())
    const syncing = ref(syncStatus.get().syncing)

    let unsubscribe: (() => void) | null = null

    onMounted(() => {
        const sync = (): void => {
            mirror.value = getMirrorState()
            syncing.value = syncStatus.get().syncing
        }
        sync()
        unsubscribe = syncStatus.subscribe(sync)
    })

    onUnmounted(() => {
        unsubscribe?.()
        unsubscribe = null
    })

    return {
        /** 是否离线（只读） */
        isOffline: isReadOnly,
        /** 镜像完整拉取时间（`null` = 从未完整拉取） */
        mirrorPulledAt: computed(() => mirror.value.mirrorPulledAt),
        /** 镜像是否触顶 */
        mirrorTruncated: computed(() => mirror.value.mirrorTruncated),
        /** 引擎是否正在续拉（瞬态覆盖度提示） */
        syncing
    }
}