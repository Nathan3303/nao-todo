<script setup lang="ts">
/**
 * 设置「数据与关于」分类面板（T535）
 * @description 同步状态一行（**只读**，无控件、无新请求）· 本地数据与安全说明（默认折叠，全文 `v-if` 渲染）
 *              · 版本号 + 「查看更新」外链（打开项目 Releases 页；无自动更新基建，文案不暗示自动更新）。
 *              时间口径与侧栏**同源同 helper**（`mirrorPulledAt` + `formatMirrorPulledAt`）。
 * @see docs/prds/2026-10-24-settings-ia.md（AC7 · AC8 · AC9 · R4 · R6 · R7）
 */
import { computed, ref } from 'vue'
import { locale, t } from '@nao-todo/shared/locales'
import { formatMirrorPulledAt } from '@nao-todo/presentation/offline'
import { useSyncStatus } from '@/hooks'
import { SettingsLocalDataNotice } from '../local-data-notice'

defineOptions({ name: 'SettingsDataPanel' })

/** 项目发布页（只开外链：桌面经既有 setWindowOpenHandler → shell.openExternal 拉起系统浏览器） */
const RELEASES_URL = 'https://github.com/Nathan3303/nao-todo/releases'

// 应用版本号（只读展示）：构建期由各端 vite `define` 从对应 package.json 注入；
// 注入缺失（非常规构建）时降级为空串，不渲染占位
const appVersion = import.meta.env.VITE_APP_VERSION || ''

const { status } = useSyncStatus()

// @state 本地数据说明展开态（默认折叠：折叠态全文不进 DOM）
const localDataOpen = ref(false)

/** 首行时间文案：同步中 / 上次同步（与侧栏同一 helper）/ 从未同步 */
const syncTimeText = computed(() => {
    if (status.value.syncing) return t('sync.syncing')
    const formatted = formatMirrorPulledAt(status.value.mirrorPulledAt, locale.value)
    return formatted ? t('sync.lastSyncAt', { time: formatted }) : t('sync.neverSynced')
})

/** 失败只给文案，不给「重试」（R7：恢复同步是侧栏的职责，设置里不新增请求） */
const syncErrorText = computed(() =>
    status.value.failedCount > 0 ? t('sync.failed', { count: status.value.failedCount }) : ''
)

const openReleases = (): void => {
    window.open(RELEASES_URL, '_blank', 'noopener')
}
</script>

<template>
    <div class="sd-cat" data-settings-category="data">
        <section class="sd-group">
            <header class="sd-group__head">
                <h2 class="sd-group__title">{{ t('settings.ia.data.name') }}</h2>
                <p class="sd-group__desc">{{ t('settings.ia.data.desc') }}</p>
            </header>

            <!-- 同步状态（只读一行：无按钮、无链接、无开关） -->
            <div class="sd-row sd-row--stack" data-setting-id="sync-status">
                <span class="sd-row__label">{{ t('settings.ia.sync.title') }}</span>
                <p class="sd-row__hint">{{ syncTimeText }}</p>
                <p v-if="syncErrorText" class="sd-row__hint">{{ syncErrorText }}</p>
            </div>

            <!-- 本地数据与安全：默认折叠（标题 + 一句摘要可见），展开后与既有文案逐字一致 -->
            <div class="sd-row sd-row--stack" data-setting-id="local-data">
                <button
                    type="button"
                    class="sd-row__toggle"
                    data-setting-action="toggle-local-data"
                    :aria-expanded="localDataOpen"
                    @click="localDataOpen = !localDataOpen"
                >
                    <nue-icon name="help" size="1rem" />
                    <span class="sd-row__label">{{ t('settings.localData.title') }}</span>
                    <nue-icon
                        class="sd-row__chevron"
                        :name="localDataOpen ? 'arrow-up' : 'arrow-down'"
                        size="1rem"
                    />
                </button>
                <p v-if="!localDataOpen" class="sd-row__hint">{{ t('settings.localData.desc') }}</p>
                <settings-local-data-notice v-if="localDataOpen" />
            </div>

            <!-- 版本与更新：只读版本号 + 发布页外链（诚实文案，无自动更新） -->
            <div class="sd-row" data-setting-id="version">
                <div class="sd-row__text">
                    <span class="sd-row__label">
                        {{ t('settings.version', { version: appVersion }) }}
                    </span>
                    <p class="sd-row__hint">{{ t('settings.ia.version.hint') }}</p>
                </div>
                <button
                    type="button"
                    class="sd-row__action"
                    data-setting-action="check-update"
                    @click="openReleases"
                >
                    {{ t('settings.ia.version.check') }}
                </button>
            </div>
        </section>
    </div>
</template>