<script setup lang="ts">
/**
 * 离线只读可见提示（C-59 / AC10）
 * @description 离线（只读）时**常驻**提示：阶段一禁写 + 明确「暂不支持修改」。
 *              两端通用；由 `useReadOnlyState` 响应式订阅网络态/离线进入态。
 *              只提示、不阻断（阻断由 `write-gate` 在用例装配层完成）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59）
 */
import { t } from '@nao-todo/shared'
import { useReadOnlyState } from './read-only-state'

defineOptions({ name: 'OfflineReadOnlyBanner' })

const { isReadOnly } = useReadOnlyState()
</script>

<template>
    <div v-if="isReadOnly" class="offline-readonly-banner" role="status" aria-live="polite">
        <nue-text size="xs" color="var(--nue-warning-color-60)">
            {{ t('offline.readOnlyBanner') }}
        </nue-text>
    </div>
</template>

<style scoped>
.offline-readonly-banner {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
    border-bottom: 1px solid var(--nue-warning-color-30);
    background-color: var(--nue-warning-color-10);
}
</style>