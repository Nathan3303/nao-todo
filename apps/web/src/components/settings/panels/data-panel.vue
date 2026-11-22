<script setup lang="ts">
/**
 * 设置「数据与关于」分类面板（T535 / T737）
 * @description 同步状态一行（**只读**，无控件、无新请求）· 本地数据与安全说明（默认折叠，全文 `v-if` 渲染）
 *              · 版本与更新：**Web 端**保持既有「版本号 + 查看更新」外链行（逐字不变，AC10）；
 *              **桌面端**升级为「关于与更新」卡（R1 版本行永不替换 + R2 八态状态行 + 动作区）。
 *              时间口径与侧栏**同源同 helper**（`mirrorPulledAt` + `formatMirrorPulledAt`）。
 * @see docs/prds/2026-10-24-settings-ia.md（AC7 · AC8 · AC9 · R4 · R6 · R7）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC1–AC13）
 * @see docs/designs/358-desktop-self-update.md（§5 八态 / §6 断点 / §8 无障碍 / §9 测试钩子）
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { LocaleKey } from '@nao-todo/shared/locales'
import { locale, t } from '@nao-todo/shared/locales'
import { formatMirrorPulledAt } from '@nao-todo/presentation/offline'
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import { useManualSync, useSyncStatus } from '@/hooks'
import { formatUpdateBytes, useDesktopUpdater } from '@/hooks/use-desktop-updater'
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

// ===== 桌面端「关于与更新」（T737 · 仅桌面端渲染；Web 走上面那行，逐字不变） =====
const {
    isDesktop: isDesktopUpdater,
    status: update,
    loaded: updateLoaded,
    check: checkUpdate,
    download: downloadUpdate,
    restartToInstall: restartAndInstall,
    openDownloadPage,
    markSeen
} = useDesktopUpdater()

// @state 「稍后」已点（设计稿 §5：文案不变、去掉「稍后」；离开 ready 态后复位）
const laterDismissed = ref(false)
// @state 卡 A 数据护栏（仅 ready + 队列非空时出现）
const guardOpen = ref(false)
const guardBody = ref<HTMLElement | null>(null)
const CHECK_REASON_ID = 'settings-update-check-blocked-reason'
const { run: runManualSync } = useManualSync()

const updateState = computed(() => update.value.state)
const updatePlatformDegraded = computed(() => update.value.installMode === 'download-page')

/** 当前版本：主进程 `app.getVersion()`，缺省回落构建注入版本 */
const currentVersionText = computed(() => update.value.currentVersion || appVersion)

/** 上次检查时间（R1 hint；从未检查 ⇒ 空串不渲染） */
const lastCheckedText = computed(() => {
    const formatted = formatMirrorPulledAt(update.value.lastCheckedAt ?? null, locale.value)
    return formatted ? t('settings.update.lastChecked', { time: formatted }) : ''
})

/**
 * R1 hint 是否渲染
 * @description `up-to-date` 时同一时间已在 R2 补充说明里出现一次 ⇒ R1 让位，避免同卡重复同一行
 */
const r1CheckedText = computed(() =>
    updateState.value === 'up-to-date' || updateState.value === 'just-updated'
        ? ''
        : lastCheckedText.value
)

/** 三态可辨之一：符号（颜色与文字见样式与文案）；`checking` 的 spinner 由 `LoadingError` 承担 */
const SYMBOLS = {
    idle: '–',
    checking: '…',
    available: '↑',
    downloading: '…',
    ready: '↓',
    'up-to-date': '✓',
    'just-updated': '✓',
    failed: '×'
} as const

const TONES = {
    idle: 'muted',
    checking: 'muted',
    available: 'warning',
    downloading: 'muted',
    ready: 'success',
    'up-to-date': 'success',
    'just-updated': 'success',
    failed: 'error'
} as const

const updateSymbol = computed(() => SYMBOLS[updateState.value])
const updateTone = computed(() => TONES[updateState.value])

const STATE_TEXT_KEYS = {
    idle: 'settings.update.idle',
    checking: 'settings.update.checking',
    downloading: 'settings.update.downloading',
    ready: 'settings.update.ready'
} as const satisfies Partial<Record<string, LocaleKey>>

const FAILURE_TITLE_KEYS = {
    check: 'settings.update.failedCheck',
    download: 'settings.update.failedDownload',
    verify: 'settings.update.failedVerify'
} as const satisfies Record<string, LocaleKey>

const REASON_KEYS = {
    offline: 'settings.update.reason.offline',
    timeout: 'settings.update.reason.timeout',
    server: 'settings.update.reason.server',
    disk: 'settings.update.reason.disk',
    unknown: 'settings.update.reason.unknown'
} as const satisfies Record<string, LocaleKey>

/** 状态文字（阶段结论；失败按失败阶段取标题） */
const updateStateText = computed(() => {
    switch (updateState.value) {
        case 'available':
            return t('settings.update.available', { version: update.value.latestVersion ?? '' })
        case 'up-to-date':
            return t('settings.update.upToDate', { version: currentVersionText.value })
        case 'just-updated':
            return t('settings.update.justUpdated', { version: currentVersionText.value })
        case 'failed': {
            const stage = update.value.failure?.stage ?? 'check'
            return t(FAILURE_TITLE_KEYS[stage])
        }
        default:
            return t(STATE_TEXT_KEYS[updateState.value])
    }
})

/** 进度百分比（`percent` 优先；只有 done/total 时现算；未知 ⇒ null） */
const progressPercent = computed<number | null>(() => {
    const raw = update.value.percent
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, Math.min(100, Math.round(raw)))
    }
    const done = update.value.downloadedBytes
    const total = update.value.totalBytes
    if (typeof done === 'number' && typeof total === 'number' && total > 0) {
        return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
    }
    return null
})

/** 已下载量文案（done / total 都已知才写 MB；缺任一侧 ⇒ `null`，⛔ 不写「—」「0 MB」） */
const downloadedSizeText = computed<string | null>(() => {
    const done = formatUpdateBytes(update.value.downloadedBytes, locale.value)
    const total = formatUpdateBytes(update.value.totalBytes ?? update.value.sizeBytes, locale.value)
    return done && total ? t('settings.update.downloadingSize', { done, total }) : null
})

/** 补充说明（第二行）：按状态取文案；体积未知 ⇒ 不写 MB、不编数字 */
const updateHintText = computed(() => {
    switch (updateState.value) {
        case 'idle':
            return t('settings.update.idleHint')
        case 'checking':
            return ''
        case 'available': {
            if (updatePlatformDegraded.value) {
                // 平台降级原因只在能判定具体系统时给（开发态 win32 也是 download-page 但无原因）
                const reason = update.value.degradedReason
                if (reason === 'deb') return t('settings.update.manual.deb')
                if (reason === 'mac') return t('settings.update.manual.mac')
                return ''
            }
            const size = formatUpdateBytes(update.value.sizeBytes, locale.value)
            return size
                ? t('settings.update.availableHint', { size })
                : t('settings.update.availableHintNoSize')
        }
        case 'downloading':
            return (
                downloadedSizeText.value ??
                (progressPercent.value !== null
                    ? t('settings.update.downloadingPercent', { percent: progressPercent.value })
                    : t('settings.update.downloading'))
            )
        case 'ready':
            return t('settings.update.readyHint')
        case 'up-to-date':
            return lastCheckedText.value
        case 'just-updated':
            return t('settings.update.justUpdatedHint')
        case 'failed': {
            const reason = update.value.failure?.reason ?? 'unknown'
            return t(REASON_KEYS[reason])
        }
        default:
            return ''
    }
})

/** R1 检查按钮禁用理由（`ready` 期不得被检查结果覆盖已下载成果；AC11：其余态恒可再点） */
const checkBlocked = computed(
    () =>
        updateState.value === 'ready' ||
        updateState.value === 'downloading' ||
        updateState.value === 'checking'
)
const checkBlockedReason = computed(() =>
    updateState.value === 'ready'
        ? t('settings.update.checkBlockedByReady')
        : updateState.value === 'downloading'
          ? t('settings.update.downloading')
          : t('settings.update.checking')
)

const showDownloadNow = computed(
    () => updateState.value === 'available' && !updatePlatformDegraded.value
)
const showOpenDownloadPage = computed(
    () =>
        (updateState.value === 'available' && updatePlatformDegraded.value) ||
        updateState.value === 'failed'
)
const showReadyActions = computed(() => updateState.value === 'ready')
const showLater = computed(() => showReadyActions.value && !laterDismissed.value)
const showRetry = computed(() => updateState.value === 'failed')

const retry = (): void => {
    // 检查失败 ⇒ 重查；下载 / 校验失败 ⇒ 重新下载（AC4 / AC5）
    if (update.value.failure?.stage === 'check' || !update.value.failure) void checkUpdate()
    else void downloadUpdate()
}

/** 进入「已就绪」后重置「稍后」；离开 ready 再复位，避免下次就绪时少了「稍后」 */
watch(updateState, (state) => {
    if (state !== 'ready') laterDismissed.value = false
})

/** 面板里看到可用更新 ⇒ 清侧栏弱提示（设备级 `lastSeenUpdateVersion`） */
watch(
    () => [update.value.updateAvailable, update.value.latestVersion] as const,
    ([available]) => {
        if (available) markSeen()
    },
    { immediate: true }
)

// —— 卡 A：重启前数据护栏（判据 = 同步队列非空；⛔ 不用 `failedCount`，它是内存态、重启清零）——
let guardReturnFocus: HTMLElement | null = null

const restartWithGuard = (): void => {
    if (status.value.pendingCount > 0) {
        guardReturnFocus =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        guardOpen.value = true
        return
    }
    void restartAndInstall()
}

const cancelGuard = (): void => {
    guardOpen.value = false
}

const syncThenRestart = (): void => {
    guardOpen.value = false
    void runManualSync()
}

/** 「仍要更新」= 用户在卡 A 二次确认 ⇒ 安装载荷带 `force`（主进程据此放行） */
const restartAnyway = (): void => {
    guardOpen.value = false
    void restartAndInstall(true)
}

const onGuardOpened = (): void => {
    void nextTick(() => {
        guardBody.value?.querySelector<HTMLElement>('[data-guard-primary]')?.focus()
    })
}

const onGuardClosed = (): void => {
    guardReturnFocus?.focus()
    guardReturnFocus = null
}

/** 焦点陷阱（`nue-dialog` 自身不含 trap，卡 A 为模态确认 ⇒ 由本块补） */
const onGuardKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return
    const nodes = guardBody.value?.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (!nodes || nodes.length === 0) return
    const list = Array.from(nodes)
    const first = list[0]
    const last = list[list.length - 1]
    if (!first || !last) return
    if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
    } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
    }
}
</script>

<template>
    <div class="sd-cat" data-settings-category="data">
        <section class="sd-group">
            <header class="sd-group__head">
                <h2 class="sd-group__title">{{ t('settings.ia.data.name') }}</h2>
                <p class="sd-group__desc" data-settings-desc>{{ t('settings.ia.data.desc') }}</p>
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

            <!-- 版本与更新（Web）：只读版本号 + 发布页外链（诚实文案，无自动更新）——
                 ⛔ AC10：本行在 Web 端**逐字不变**；桌面端由下方「关于与更新」卡替代 -->
            <div v-if="!isDesktopUpdater" class="sd-row" data-setting-id="version">
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

        <!-- 关于与更新（仅桌面端渲染；Web / 移动端整块不渲染、无空容器、无占位） -->
        <section v-if="isDesktopUpdater" class="sd-group sd-update" data-setting-id="version">
            <h3 class="sd-update__label">{{ t('settings.update.title') }}</h3>
            <div class="sd-update__card">
                <!-- R1 版本行：永不被状态替换（我在用哪版 / 能不能查） -->
                <div class="sd-update__r1">
                    <div class="sd-update__r1-text">
                        <span class="sd-update__version">
                            {{
                                t('settings.update.currentVersion', { version: currentVersionText })
                            }}
                        </span>
                        <span v-if="r1CheckedText" class="sd-update__checked">
                            {{ r1CheckedText }}
                        </span>
                    </div>
                    <span
                        class="sd-update__check"
                        :title="checkBlocked ? checkBlockedReason : undefined"
                    >
                        <span v-if="checkBlocked" :id="CHECK_REASON_ID" class="sd-update__sr">
                            {{ checkBlockedReason }}
                        </span>
                        <nue-button
                            data-setting-action="check-update"
                            :disabled="checkBlocked"
                            :loading="updateState === 'checking'"
                            :aria-describedby="checkBlocked ? CHECK_REASON_ID : undefined"
                            @click="checkUpdate()"
                        >
                            {{ t('settings.update.check') }}
                        </nue-button>
                    </span>
                </div>

                <!-- R2 状态行：八态（`data-update-state` 直取状态机字面量） -->
                <div
                    class="sd-update__r2"
                    data-setting-id="update-status"
                    :data-update-state="updateState"
                    :data-update-platform-degraded="String(updatePlatformDegraded)"
                >
                    <!-- 动作级加载态：`checking` 用 `LoadingError`（DESIGN §4.1 已登记口径） -->
                    <loading-error
                        v-if="updateState === 'checking'"
                        :loading="true"
                        :loading-message="t('settings.update.checking')"
                    />
                    <template v-else>
                        <div class="sd-update__status">
                            <span
                                class="sd-update__symbol"
                                :class="`is-${updateTone}`"
                                aria-hidden="true"
                            >
                                {{ updateSymbol }}
                            </span>
                            <div class="sd-update__status-text">
                                <span
                                    class="sd-update__state"
                                    :class="`is-${updateTone}`"
                                    :role="updateLoaded ? 'status' : undefined"
                                    :aria-live="updateLoaded ? 'polite' : 'off'"
                                    >{{ updateStateText }}</span
                                >
                                <span v-if="updateHintText" class="sd-update__hint">
                                    {{ updateHintText }}
                                </span>
                                <!-- 下载进度：有总量才给百分比（未知 ⇒ 只给「正在下载」，⛔ 不编数字） -->
                                <div
                                    v-if="updateState === 'downloading'"
                                    class="sd-update__progress"
                                    role="progressbar"
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                    :aria-valuenow="progressPercent ?? undefined"
                                    :aria-valuetext="
                                        progressPercent === null
                                            ? t('settings.update.a11y.progressUnknown')
                                            : t('settings.update.a11y.progress', {
                                                  percent: progressPercent
                                              })
                                    "
                                >
                                    <div class="sd-update__track">
                                        <div
                                            class="sd-update__progress-bar"
                                            :style="{
                                                width: `${progressPercent ?? 0}%`
                                            }"
                                        />
                                    </div>
                                    <span
                                        v-if="progressPercent !== null"
                                        class="sd-update__progress-value"
                                    >
                                        {{ progressPercent }}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="sd-update__actions">
                            <nue-button
                                v-if="showDownloadNow"
                                theme="primary"
                                data-update-action="download"
                                @click="downloadUpdate()"
                            >
                                {{ t('settings.update.updateNow') }}
                            </nue-button>
                            <nue-button
                                v-if="showReadyActions"
                                theme="primary"
                                data-update-action="restart"
                                @click="restartWithGuard()"
                            >
                                {{ t('settings.update.restartNow') }}
                            </nue-button>
                            <nue-button
                                v-if="showLater"
                                theme="ghost"
                                data-update-action="later"
                                @click="laterDismissed = true"
                            >
                                {{ t('settings.update.later') }}
                            </nue-button>
                            <nue-button
                                v-if="showRetry"
                                data-update-action="retry"
                                @click="retry()"
                            >
                                {{ t('common.retry') }}
                            </nue-button>
                            <nue-button
                                v-if="showOpenDownloadPage"
                                :theme="showRetry ? 'ghost' : 'primary'"
                                data-update-action="open-download-page"
                                @click="openDownloadPage()"
                            >
                                {{ t('settings.update.openDownloadPage') }}
                            </nue-button>
                        </div>
                    </template>
                </div>
            </div>
        </section>

        <!-- 卡 A：重启前数据护栏（仅「已就绪 → 立即重启更新」且队列非空；取消/关闭保留已下载） -->
        <nue-dialog
            v-if="isDesktopUpdater"
            v-model="guardOpen"
            theme="update-guard"
            :title="t('settings.update.guard.title')"
            @after-open="onGuardOpened"
            @after-close="onGuardClosed"
        >
            <div
                ref="guardBody"
                class="sd-update-guard"
                role="dialog"
                aria-modal="true"
                :aria-label="t('settings.update.guard.title')"
                tabindex="-1"
                @keydown="onGuardKeydown"
            >
                <p class="sd-update-guard__body">
                    {{ t('settings.update.guard.body', { count: status.pendingCount }) }}
                </p>
                <div class="sd-update-guard__actions">
                    <nue-button
                        theme="primary"
                        data-guard-primary
                        data-update-action="guard-sync"
                        @click="syncThenRestart()"
                    >
                        {{ t('settings.update.guard.syncFirst') }}
                    </nue-button>
                    <nue-button
                        theme="destructive"
                        data-update-action="guard-anyway"
                        @click="restartAnyway()"
                    >
                        {{ t('settings.update.guard.updateAnyway') }}
                    </nue-button>
                    <nue-button
                        theme="ghost"
                        data-update-action="guard-cancel"
                        @click="cancelGuard()"
                    >
                        {{ t('common.cancel') }}
                    </nue-button>
                </div>
            </div>
        </nue-dialog>
    </div>
</template>

<style scoped>
/* ===== 关于与更新（T737）=====
   桌面密度：控件 30px / 正文 13px / 卡片边框承托；断点按**面板可用宽**（容器查询），非视口。
   ⛔ 不加底色、不加阴影；颜色全取 nue-* token（DESIGN §3 已登记 30px 例外） */
.sd-update {
    /* 左边缘基准（设计稿 §3「对齐基准」）：inset 的唯一来源 = 同面板既有行的水平内边距 ——
       `.sd-row` / `.sd-group__head` 的 `--nue-padding-sm`（宽 / 中档）。缺这条 ⇒ 标签与卡片直接贴
       `.sd-cat` 边缘，比上方文字整体左移一个 `--nue-padding-sm`（T742 走查实报）。 */
    padding: 0 var(--nue-padding-sm);
    container-type: inline-size;
}

/* 窄屏：既有行 / 组头的水平内边距收到 `--nue-padding-2xs` ⇒ 更新块取同一 token、随同一断点切换
   （`.sd-body.is-narrow` 见 `settings/dialog/index.vue`；设计稿 §3 / §6） */
.sd-body.is-narrow .sd-update {
    padding: 0 var(--nue-padding-2xs);
}

.sd-update__label {
    margin: 0 0 12px;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-sm);
    font-weight: 600;
    line-height: 1.4;
}

.sd-update__card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--nue-border-color);
    border-radius: 8px;
    padding: 16px;
}

.sd-update__r1 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 48px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--nue-border-color);
}

.sd-update__r1-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.sd-update__version {
    color: var(--nue-primary-color-900);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
}

.sd-update__checked {
    color: var(--nue-secondary-text-color);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
}

.sd-update__check {
    flex: none;
    display: inline-flex;
}

.sd-update__sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
}

.sd-update__r2 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 46px;
    padding-top: 12px;
}

.sd-update__status {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
}

.sd-update__symbol {
    flex: none;
    width: 18px;
    font-size: 18px;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
    text-align: center;
}

.sd-update__symbol.is-warning {
    color: var(--nue-warning-color-80);
}

.sd-update__symbol.is-success {
    color: var(--nue-success-color-80);
}

.sd-update__symbol.is-error {
    color: var(--nue-error-color-80);
}

.sd-update__symbol.is-muted {
    color: var(--nue-secondary-text-color);
}

.sd-update__status-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.sd-update__state {
    color: var(--nue-primary-color-900);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
}

.sd-update__state.is-warning {
    color: var(--nue-warning-color-90);
}

.sd-update__state.is-success {
    color: var(--nue-success-color-90);
}

.sd-update__state.is-error {
    color: var(--nue-error-color-90);
}

.sd-update__hint {
    color: var(--nue-secondary-text-color);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
}

/* 进度：3px 轨 + 完成段，⛔ 不带语义色（绿/红会被读成成败结论） */
.sd-update__progress {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 240px;
    max-width: 100%;
}

.sd-update__track {
    flex: 1 1 auto;
    height: 3px;
    border-radius: 2px;
    background: var(--nue-primary-color-100);
    overflow: hidden;
}

.sd-update__progress-bar {
    height: 3px;
    border-radius: 2px;
    background: var(--nue-primary-color-900);
}

.sd-update__progress-value {
    flex: none;
    color: var(--nue-primary-color-900);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.sd-update__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    /* 预留最小宽：状态切换时动作区不跳位（设计稿 §9 坑 ⑥） */
    min-width: 8rem;
}

/* 控件 30px（DESIGN §3 已登记例外：仅本块；键盘可达与 focus 可见不降级） */
.sd-update :deep(.nue-button) {
    height: 30px;
    font-size: 13px;
    box-shadow: none;
}

.sd-update :deep(.nue-button:focus-visible) {
    outline: 2px solid var(--nue-primary-color-900);
    outline-offset: 2px;
}

/* —— 断点（容器查询，按面板可用宽）—— */
@container (max-width: 519.98px) {
    .sd-update__r1,
    .sd-update__r2 {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        min-height: 0;
    }

    .sd-update__actions {
        justify-content: flex-end;
    }
}

@container (max-width: 379.98px) {
    .sd-update__r1,
    .sd-update__r2 {
        flex-direction: column;
        align-items: stretch;
    }

    .sd-update__actions {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
    }

    .sd-update__actions :deep(.nue-button) {
        width: 100%;
        justify-content: center;
    }

    .sd-update__check :deep(.nue-button) {
        width: 100%;
        justify-content: center;
    }
}

/* ===== 卡 A（数据护栏）===== */
.sd-update-guard {
    display: flex;
    flex-direction: column;
    gap: 20px;
    outline: none;
}

.sd-update-guard__body {
    margin: 0;
    color: var(--nue-primary-color-900);
    font-size: 13px;
    line-height: 1.6;
}

.sd-update-guard__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
}

.sd-update-guard :deep(.nue-button) {
    height: 30px;
    font-size: 13px;
    box-shadow: none;
}

.sd-update-guard :deep(.nue-button:focus-visible) {
    outline: 2px solid var(--nue-primary-color-900);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .sd-update__progress-bar {
        transition: none;
    }
}

/* 卡 A 对话框尺寸：宽 400（窄屏不溢出），高按文案自适应（英文字面更长，⛔ 不许截断） */
:global(.nue-dialog.nue-dialog--update-guard) {
    width: min(400px, 92vw);
    box-sizing: border-box;
}
</style>