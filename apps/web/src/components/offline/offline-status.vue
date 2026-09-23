<script setup lang="ts">
/**
 * 离线/镜像状态条（C-60 文案三分 + 覆盖度/触顶，web 展示面）
 * @description 三态**互斥穷尽**：在线 ⇒「已更新」；回退镜像 ⇒「离线模式 · 数据截至 {时间}」+「可能不是最新」；
 *              `mirrorPulledAt` 为空/非法 ⇒「尚未同步完成，数据可能不完整」+ 联网引导（AC9：不得呈现为数据丢失）。
 *              覆盖度两条**独立**渲染（未扫完瞬态 / 触顶常驻），不合并成一条。
 *              触顶 N 取镜像中**实际已加载**行数（AC13b / PM 裁定：不用固定上限，两种截断原因下都真实）。
 *              时间一律经 `formatMirrorPulledAt`（非法值落 ③）⇒ **不会**出现 `null` / `Invalid Date` / 1970。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59 / C-60）
 */
import { computed } from 'vue'
import { locale, t } from '@nao-todo/shared'
import {
    formatMirrorPulledAt,
    resolveCoverageHints,
    resolveFreshness
} from '@nao-todo/presentation/offline'
import { useMirrorStatus } from './use-mirror-status'
import { useMirrorLoadedCount } from './use-mirror-loaded-count'

defineOptions({ name: 'OfflineStatus' })

const { isOffline, mirrorPulledAt, mirrorTruncated, syncing } = useMirrorStatus()

/** 触顶文案 N：镜像中实际已加载行数（0 ⇒ 用通用文案，不编造数字） */
const loadedCount = useMirrorLoadedCount()

const freshness = computed(() =>
    resolveFreshness({
        isOffline: isOffline.value,
        mirrorPulledAt: mirrorPulledAt.value,
        mirrorTruncated: mirrorTruncated.value
    })
)

const timeText = computed(() => formatMirrorPulledAt(mirrorPulledAt.value, locale.value))

const coverage = computed(() =>
    resolveCoverageHints({ syncing: syncing.value, mirrorTruncated: mirrorTruncated.value })
)
</script>

<template>
    <div
        class="offline-status"
        :class="{ 'is-alert': freshness !== 'updated' || coverage.truncated }"
        role="status"
        aria-live="polite"
    >
        <!-- ③ 尚未同步完成（含空镜像/截断）：引导联网，不呈现为「数据丢失」 -->
        <template v-if="freshness === 'incomplete'">
            <nue-text size="xs" color="var(--nue-warning-color-60)">
                {{ t('offline.freshness.incomplete') }}
            </nue-text>
            <nue-text size="xs" color="var(--nue-secondary-text-color)">
                {{ t('offline.freshness.incompleteHint') }}
            </nue-text>
        </template>
        <!-- ② 回退本地镜像：显示「数据截至 X」+「可能不是最新」 -->
        <template v-else-if="freshness === 'mirror'">
            <nue-text size="xs" color="var(--nue-warning-color-60)">
                {{ t('offline.freshness.mirror', { time: timeText ?? '' }) }}
            </nue-text>
            <nue-text size="xs" color="var(--nue-secondary-text-color)">
                {{ t('offline.freshness.mirrorHint') }}
            </nue-text>
        </template>
        <!-- ① 在线 · 远端数据 -->
        <nue-text v-else size="xs" color="var(--nue-secondary-text-color)">
            {{ t('offline.freshness.updated') }}
        </nue-text>

        <!-- 覆盖度：未扫完（瞬态，自动消失） -->
        <nue-text v-if="coverage.loadingMore" size="xs" color="var(--nue-secondary-text-color)">
            {{ t('offline.coverage.loadingMore') }}
        </nue-text>
        <!-- 覆盖度：触顶（常驻，独立于上一条） -->
        <nue-text v-if="coverage.truncated" size="xs" color="var(--nue-warning-color-60)">
            {{
                loadedCount > 0
                    ? t('offline.coverage.truncated', { count: loadedCount })
                    : t('offline.coverage.truncatedGeneric')
            }}
        </nue-text>
    </div>
</template>

<style scoped>
.offline-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--nue-gap-xs) var(--nue-gap-sm);
    padding: var(--nue-padding-xs) var(--nue-padding-md);
    border-bottom: 1px solid var(--nue-border-color);
}

/* 仅离线/镜像/触顶时着警示底色；在线「已更新」保持中性，避免常驻噪音 */
.offline-status.is-alert {
    background-color: var(--nue-warning-color-10);
}
</style>