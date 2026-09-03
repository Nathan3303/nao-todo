<script setup lang="ts">
/**
 * 同步状态组件（Phase 3 可观测）
 * @description 左下方悬浮：默认收起为状态点 + 文案，鼠标移入展开完整信息；
 *              颜色全部使用 NueUI 主题变量（--nue-*），随主题切换自动适配。
 */
import { ref } from 'vue'
import { useManualSync, useSyncStatus } from '@/hooks'

defineOptions({ name: 'SyncStatusBar' })

const expanded = ref(false)

const { status } = useSyncStatus()
const { syncing: manualSyncing, run: runManualSync } = useManualSync()

const formatTime = (iso: string | null): string => {
    if (!iso) return '从未同步'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '从未同步'
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
    <nue-div
        class="sync-status-widget"
        align="center"
        gap="0.5rem"
        @mouseenter="expanded = true"
        @mouseleave="expanded = false"
    >
        <!-- 收起态：状态点 + 文案 -->
        <template v-if="!expanded">
            <span
                class="sync-dot"
                :class="{
                    syncing: status.syncing || manualSyncing,
                    pending: !status.syncing && !manualSyncing && status.pendingCount > 0,
                    failed: !status.syncing && !manualSyncing && status.failedCount > 0
                }"
            />
            <nue-text size="0.75rem">同步</nue-text>
        </template>
        <!-- 展开态：完整信息 + 手动同步 -->
        <template v-else>
            <template v-if="status.syncing || manualSyncing">
                <nue-text size="0.75rem" color="gray">同步中…</nue-text>
            </template>
            <template v-else>
                <nue-text size="0.75rem" color="gray"
                    >同步 {{ formatTime(status.lastSyncAt) }}</nue-text
                >
                <nue-text
                    v-if="status.lastError"
                    size="0.75rem"
                    color="danger"
                    :title="status.lastError"
                    >{{ status.lastError }}</nue-text
                >
                <nue-text v-if="status.pendingCount > 0" size="0.75rem" color="warning">
                    待推送 {{ status.pendingCount }}
                </nue-text>
                <nue-text v-if="status.failedCount > 0" size="0.75rem" color="danger">
                    失败 {{ status.failedCount }}
                </nue-text>
                <nue-button
                    size="small"
                    theme="pure"
                    :loading="manualSyncing"
                    @click="runManualSync"
                >
                    立即同步
                </nue-button>
            </template>
        </template>
    </nue-div>
</template>

<style scoped>
.sync-status-widget {
    position: fixed;
    left: 1rem;
    bottom: 1rem;
    z-index: 9999;
    padding: 0.375rem 0.75rem;
    border-radius: 999px;
    background: var(--nue-bg-color);
    border: 1px solid var(--nue-border-color);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
    cursor: default;
}

.sync-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--nue-primary-color-500);
    transition: background-color 0.2s ease;
}

.sync-dot.syncing {
    background: var(--nue-primary-color-500);
    animation: sync-pulse 1.2s ease-in-out infinite;
}

.sync-dot.pending {
    background: var(--warning-color);
}

.sync-dot.failed {
    background: var(--nue-danger-hsl-color);
}

@keyframes sync-pulse {
    50% {
        opacity: 0.35;
    }
}
</style>