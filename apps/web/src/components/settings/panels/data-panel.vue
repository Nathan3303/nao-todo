<script setup lang="ts">
/**
 * 设置「数据与关于」分类面板（T535 / T737 / T747）
 * @description 同步状态一行（**只读**，无控件、无新请求）· 本地数据与安全说明（默认折叠，全文 `v-if` 渲染）
 *              · 版本行：**Web 端**保持既有「版本号 + 查看更新」外链行（逐字不变，AC10），
 *              **桌面端**同一套 DOM 升为「关于与更新」块的行（R1 永不被状态替换）；
 *              桌面端另有 R2 九态状态行 + 动作簇 + 卡 A 数据护栏。
 *              时间口径与侧栏**同源同 helper**（`mirrorPulledAt` + `formatMirrorPulledAt`）。
 * @see docs/prds/2026-10-24-settings-ia.md（AC7 · AC8 · AC9 · R4 · R6 · R7）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC1–AC13）
 * @see docs/designs/358-desktop-self-update.md（v4：§1 信息架构 / §3 视觉 / §4 token / §5 九态 / §6 断点 / §9 测试钩子）
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { DesktopUpdateManualReason } from '@nao-todo/shared'
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
 * 版本行（R1）的标签与 hint：**Web / 桌面共用一套 DOM**，`v-if` 只切 handler 与这两处文案
 * @description AC10「Web 行逐字不变」由此成为**结构**保证（不是两段标记对齐）
 */
const versionLabel = computed(() =>
    isDesktopUpdater
        ? t('settings.update.currentVersion', { version: currentVersionText.value })
        : t('settings.version', { version: appVersion })
)
const versionHint = computed(() =>
    isDesktopUpdater ? lastCheckedText.value : t('settings.ia.version.hint')
)

/** 三态可辨之一：符号（颜色与文字见样式与文案）；`checking` 的 spinner 由 `LoadingError` 承担 */
const SYMBOLS = {
    unsupported: '–',
    idle: '–',
    checking: '…',
    available: '↑',
    downloading: '…',
    ready: '↓',
    'up-to-date': '✓',
    'just-updated': '✓',
    failed: '×'
} as const

/** 色档：落在既有 `.sd-desktop-status` 家族上（`is-ok` / `is-warn` / `is-error` + v4 新增 `is-muted`） */
const TONES = {
    unsupported: 'muted',
    idle: 'muted',
    checking: 'muted',
    available: 'warn',
    downloading: 'muted',
    ready: 'ok',
    'up-to-date': 'ok',
    'just-updated': 'ok',
    failed: 'error'
} as const

const updateSymbol = computed(() => SYMBOLS[updateState.value])
const updateTone = computed(() => TONES[updateState.value])

const STATE_TEXT_KEYS = {
    unsupported: 'settings.update.unsupported',
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

/**
 * `unsupported` 一行原因的键（`degradedReason` → 文案；缺省 ⇒ `unknown` 兜底，⛔ 不留空行）
 * @description 只描述「这种安装方式得去下载页」的**事实**，⛔ 不写「请重试」类动作措辞
 */
const MANUAL_REASON_KEYS = {
    mac: 'settings.update.manual.mac',
    deb: 'settings.update.manual.deb',
    dev: 'settings.update.manual.dev',
    unknown: 'settings.update.manual.unknown'
} as const satisfies Record<DesktopUpdateManualReason | 'unknown', LocaleKey>

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
            // v4 §5：时间在 R1，⛔ 同一信息不在两块重复
            return ''
        case 'just-updated':
            return t('settings.update.justUpdatedHint')
        case 'failed': {
            const reason = update.value.failure?.reason ?? 'unknown'
            return t(REASON_KEYS[reason])
        }
        case 'unsupported':
            // 前置 gate（AC4b）：一行原因说明「为什么不能应用内更新」，形态判定不出 ⇒ unknown 兜底
            return t(MANUAL_REASON_KEYS[update.value.degradedReason ?? 'unknown'])
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

/** 原地可更新的唯一主按钮（`download-page` 形态永不进 `available`：AC4b 已由 `unsupported` 前置拦掉） */
const showDownloadNow = computed(() => updateState.value === 'available')
/**
 * 「打开下载页」是**唯一**的降级出口
 * @description `unsupported`（安装形态不支持）与 `failed`（失败后想装新版）都给这一个动作；
 *              ⛔ 失败态**不提供**行内「重试」（AC4）—— 再试 = 回 R1 点「检查更新」（永久可点，AC11）
 */
const showOpenDownloadPage = computed(
    () => updateState.value === 'failed' || updateState.value === 'unsupported'
)
const showReadyActions = computed(() => updateState.value === 'ready')
const showLater = computed(() => showReadyActions.value && !laterDismissed.value)
/** 动作簇是否渲染（没有动作的态不渲染空簇） */
const hasRowAction = computed(
    () =>
        showDownloadNow.value ||
        showReadyActions.value ||
        showLater.value ||
        showOpenDownloadPage.value
)

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

            <!-- 关于与更新（桌面端专属组头，与「桌面常驻」同构；Web 端不渲染 ⇒ AC10 零外溢）。
                 块间距走 `sd-subblock`（#360 L2：组内子块 = 24，唯一来源），⛔ 不再自带 margin。 -->
            <header v-if="isDesktopUpdater" class="sd-group__head sd-subblock">
                <h3 class="sd-group__title">{{ t('settings.update.title') }}</h3>
                <p class="sd-group__desc">{{ t('settings.update.desc') }}</p>
            </header>

            <div class="sd-update__list">
                <!-- 版本行（R1 / Web 版本行**共用一套 DOM**：`v-if` 只切 handler 与文案） -->
                <div
                    class="sd-row"
                    :class="{ 'sd-update__row': isDesktopUpdater }"
                    data-setting-id="version"
                >
                    <div class="sd-row__text">
                        <span class="sd-row__label">{{ versionLabel }}</span>
                        <p v-if="versionHint" class="sd-row__hint">{{ versionHint }}</p>
                    </div>
                    <!-- 桌面端：应用内检查（secondary 36px；ready 期 disabled + 可见理由） -->
                    <span
                        v-if="isDesktopUpdater"
                        class="sd-update__check"
                        :title="checkBlocked ? checkBlockedReason : undefined"
                    >
                        <span v-if="checkBlocked" :id="CHECK_REASON_ID" class="sd-update__sr">
                            {{ checkBlockedReason }}
                        </span>
                        <nue-button
                            theme="secondary"
                            data-setting-action="check-update"
                            :disabled="checkBlocked"
                            :loading="updateState === 'checking'"
                            :aria-describedby="checkBlocked ? CHECK_REASON_ID : undefined"
                            @click="checkUpdate()"
                        >
                            {{ t('settings.update.check') }}
                        </nue-button>
                    </span>
                    <!-- Web 端：既有外链入口（逐字不变，AC10） -->
                    <button
                        v-else
                        type="button"
                        class="sd-row__action"
                        data-setting-action="check-update"
                        @click="openReleases"
                    >
                        {{ t('settings.ia.version.check') }}
                    </button>
                </div>

                <!-- R2 状态行（仅桌面端）：九态，`data-update-state` 直取状态机字面量 -->
                <div
                    v-if="isDesktopUpdater"
                    class="sd-row sd-row--stack sd-update__row"
                    data-setting-id="update-status"
                    :data-update-state="updateState"
                    :data-update-platform-degraded="String(updatePlatformDegraded)"
                >
                    <!-- 动作级加载态：`checking` 用 `LoadingError`（DESIGN §1.1 已登记口径） -->
                    <loading-error
                        v-if="updateState === 'checking'"
                        :loading="true"
                        :loading-message="t('settings.update.checking')"
                    />
                    <template v-else>
                        <!-- 首行：左状态（符号 + 文字 + 同档颜色三重冗余）右动作；行高恒 40px ⇒ 不跳位 -->
                        <div class="sd-row__line">
                            <span class="sd-desktop-status" :class="`is-${updateTone}`">
                                <span class="sd-desktop-status__symbol" aria-hidden="true">
                                    {{ updateSymbol }}
                                </span>
                                <span
                                    class="sd-row__label"
                                    :role="updateLoaded ? 'status' : undefined"
                                    :aria-live="updateLoaded ? 'polite' : 'off'"
                                    >{{ updateStateText }}</span
                                >
                            </span>
                            <div v-if="hasRowAction" class="sd-update__actions">
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
                                    theme="secondary"
                                    data-update-action="later"
                                    @click="laterDismissed = true"
                                >
                                    {{ t('settings.update.later') }}
                                </nue-button>
                                <nue-button
                                    v-if="showOpenDownloadPage"
                                    theme="primary"
                                    data-update-action="open-download-page"
                                    @click="openDownloadPage()"
                                >
                                    {{ t('settings.update.openDownloadPage') }}
                                </nue-button>
                            </div>
                        </div>

                        <!-- hint / 进度条挂在首行下方、向下生长（不回头推动首行） -->
                        <p v-if="updateHintText" class="sd-row__hint">{{ updateHintText }}</p>
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
                            <nue-progress
                                :percentage="progressPercent ?? 0"
                                :stroke-width="2"
                                color="var(--nue-primary-color-900)"
                                hide-text
                            />
                            <span v-if="progressPercent !== null" class="sd-row__hint">
                                {{ progressPercent }}%
                            </span>
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
/* ===== 关于与更新（T747 · v4：用任务列表行的语言，不新造盒子）=====
   行样式逐条取自 `.nue-div--todo-list-main__row` 的 `--small` 变体
   （`packages/presentation/task/components/list/list.css`）：浅灰底 + 6px 圆角 + 1px 透明边框 + 8/12 内边距。
   控件回归 `nue-button` 默认尺寸（36px，`--nue-box-size-df`）⇒ 30px 例外已撤回（DESIGN §3）。
   颜色全取 `nue-*`；**底色 = -100 ⇒ 文字比值必须按 -100 底重算**（设计稿 §4）。 */

/* 桌面专属组头：与上一块（本地数据与安全行）的间距 = `.sd-subblock`（#360 L2 = 24，唯一来源），
   ⛔ 不加分隔线、⛔ 不再自带 `margin-top`（旧版 2.75rem 字面值与 44+24 叠加已删）；
   组头 → 首行沿用 `.sd-group__head` 的 L3（16）。 */

/* 行距 = 任务列表行距（0.5rem） */
.sd-update__list {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
}

/* 行：底色 + 6px 圆角 + ≥40px 行高；`border: 1px solid transparent` 只为几何稳定与 hover 预留。
   `-1px` 抵消边框宽度 ⇒ 行内文字与 `.sd-group__title` / 既有 `.sd-row__label` **左缘同线**（≤0.5px） */
.sd-update__row {
    background-color: var(--nue-primary-color-100);
    border: 1px solid transparent;
    border-radius: var(--nue-primary-radius);
    min-height: var(--nue-box-size-md);
    padding: var(--nue-padding-xs) calc(var(--nue-padding-sm) - 1px);
}

/* hover 只表达「可操作的块」：⛔ 整行不接管 click / 不给 cursor: pointer / 不加 tabindex
   （设计稿 §3 / §7：不可点的行给手型 = 假 affordance；真动作只在行内 nue-button 上） */
.sd-update__row:hover {
    border-color: var(--nue-primary-color-500);
}

/* 窄档（`.sd-body.is-narrow`）⛔ **不再**另开一套行内边距：
   旧版把 `--nue-padding-2xs`（4px → 实得 3px）当水平内边距，元素几乎贴到卡边（`T795` / #398）；
   宽/窄同一台阶后，行内元素到卡边恒 = 1px 边框 + 11px 内边距 = 12px（≥ 8px 验收线）。 */

/* 行底上的 hint：⛔ 不用 `--nue-secondary-text-color`（-600 压 -100 = 4.60，仅超线 0.1 且与
   DESIGN §2 的阈值口径打架）⇒ 取 -700 = 6.77（设计稿 §4） */
.sd-update__row .sd-row__hint {
    color: var(--nue-primary-color-700);
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

/* 动作簇：恒右对齐、恒不参与文字块压缩（⛔ 不设 min-width —— v3 的占位宽已随卡片撤回） */
.sd-update__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--nue-gap-xs);
    flex: none;
}

/* 进度：用既有 `nue-progress`（先例 `task-details/main`），⛔ 不自绘进度条。
   颜色走组件自己的口子：填 = `color` prop（组件 `-innerbar-background-color` 的内联来源，-900）、
   轨 = `:deep()` 覆写（-500 = 3.16 ✓；`-200` 只有 1.29 ≈ 消失）。
   ⚠️ 不在此声明 `--nue-*` 自定义属性 —— 设置域静态守卫（settings-ia AC10）禁止新增 token 声明。 */
.sd-update__progress {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    max-width: 240px;
}

.sd-update__progress :deep(.nue-progress__outer-bar) {
    background: var(--nue-primary-color-500);
}

.sd-update__progress :deep(.nue-progress) {
    flex: 1 1 auto;
}

/* 窄屏（`.sd-body.is-narrow`，含 ≤445 窄屏形态）：动作换到文字下方、右对齐，次序与尺寸不变 */
.sd-body.is-narrow .sd-row__line {
    flex-wrap: wrap;
}

.sd-body.is-narrow .sd-update__actions {
    flex-basis: 100%;
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
    gap: var(--nue-gap-xs);
}

/* 卡 A 按钮不设尺寸覆写：随 `nue-button` 默认档（36px）—— 30px 例外已撤回（DESIGN §3） */
.sd-update-guard :deep(.nue-button:focus-visible) {
    outline: 2px solid var(--nue-primary-color-900);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .sd-update__progress :deep(.nue-progress__inner-bar) {
        transition: none;
    }
}

/* 卡 A 对话框尺寸：宽 400（窄屏不溢出），高按文案自适应（英文字面更长，⛔ 不许截断） */
:global(.nue-dialog.nue-dialog--update-guard) {
    width: min(400px, 92vw);
    box-sizing: border-box;
}
</style>