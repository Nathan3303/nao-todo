<script setup lang="ts">
/**
 * 登录设备列表（SHELL-05 · T535 R3 版式重做）
 * @description 三段式：**主行**（设备图标 + 设备名 + 「当前设备」标记，非当前设备右侧给「下线」）·
 *              **次行**（地区 + IP）· **第三行**（最近活跃 = 相对时间 + 登录时间 = 日期，两者 `title` 给完整时间戳）。
 *              **当前设备置顶**（三通道：位置 + 轻底色 + 文字标记），其余按最近活跃倒序。
 *              平铺口径：项与项之间不画线不画框，只用 12px 间距 + 当前设备轻底色区分。
 *              行为零改动：加载/下线/退出其他设备/二次确认/toast 文案与刷新节流（2s）全部沿用。
 * @see docs/prds/2026-10-24-settings-ia.md（AC2 · AC10）
 */
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { NueConfirm, NueMessage } from 'nue-ui'
import { locale, t } from '@nao-todo/shared/locales'
import { throttle } from '@nao-todo/shared/utils/commons'
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import type { UserSessionValueObject, UserUseCase } from '@nao-todo/domain-identity'
import { useUserStore } from '../../stores'
import { resolveSessionActiveAt } from './relative-time'

defineOptions({ name: 'UserSessionManager' })

const props = defineProps<{ userUseCase: UserUseCase }>()

/**
 * 设备图标：仓内图标集**没有**浏览器/手机/电脑字形（已逐名清点 23 个 `ntd-*` + 74 个 `nue` 图标，
 * 无 device / phone / laptop / globe / browser 类）⇒ 按需求「找不到合适图标就用统一通用图标」，
 * 8 类 `deviceType` 一律映射到 `drive`（本机/磁盘语义 = 「设备」，不暗示具体平台或浏览器）。
 */
const DEVICE_ICON = 'drive'

// @states
const sessions = ref<UserSessionValueObject[]>([])
const loading = ref(false)
const loadFailed = ref(false)
// SHELL-06 G13：离线（profile 缺失）时列表不可用 ⇒ 显示「需联网」占位，不弹 toast 噪声
const needsNetwork = ref(false)
const { profile } = storeToRefs(useUserStore())

/**
 * 加载会话列表
 */
const loadSessions = async () => {
    loading.value = true
    loadFailed.value = false
    const [list, err] = await props.userUseCase.loadSessions()
    loading.value = false
    if (err !== null) {
        // 离线无 profile：显示占位而非 toast 噪声（不阻塞、不打断）
        if (!profile.value) {
            needsNetwork.value = true
            return
        }
        loadFailed.value = true
        NueMessage.error(t('settings.sessionLoadFailed'))
        return
    }
    needsNetwork.value = false
    sessions.value = list ?? []
}
onMounted(loadSessions)

/**
 * 刷新会话列表（节流：2s 内重复点击只触发一次）
 */
const handleRefreshSessions = throttle(loadSessions, 2000)

/**
 * 设备类型文案映射
 */
const DEVICE_LABEL_KEY: Record<string, string> = {
    Chrome: 'settings.sessionDeviceChrome',
    Safari: 'settings.sessionDeviceSafari',
    Firefox: 'settings.sessionDeviceFirefox',
    iOS: 'settings.sessionDeviceIOS',
    Android: 'settings.sessionDeviceAndroid',
    WeChat: 'settings.sessionDeviceWeChat',
    Alipay: 'settings.sessionDeviceAlipay',
    Unknown: 'settings.sessionDeviceUnknown'
}
const deviceLabel = (type: string): string =>
    t((DEVICE_LABEL_KEY[type] ?? 'settings.sessionDeviceUnknown') as never)

/**
 * 排序：当前设备置顶 ⇒ 其余按最近活跃倒序（非法时间视为最旧，不参与比较）
 */
const orderedSessions = computed(() =>
    [...sessions.value].sort((a, b) => {
        if (a.current !== b.current) return a.current ? -1 : 1
        const left = new Date(b.updatedAt).getTime()
        const right = new Date(a.updatedAt).getTime()
        const leftValid = Number.isFinite(left)
        const rightValid = Number.isFinite(right)
        if (!leftValid || !rightValid) return leftValid ? 1 : rightValid ? -1 : 0
        return left - right
    })
)

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}

const toDate = (iso: string): Date | null => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
}

/** 登录时间：仅日期（本地时区；跟随**应用语言**，与设置页其余时间口径一致） */
const dateText = (iso: string): string => {
    const date = toDate(iso)
    return date ? date.toLocaleDateString(locale.value, DATE_OPTIONS) : '—'
}

/** `title` 用完整时间戳（本地时区，含时分秒；跟随应用语言） */
const fullText = (iso: string): string => {
    const date = toDate(iso)
    return date ? date.toLocaleString(locale.value) : '—'
}

/** 最近活跃：刚刚 / 昨天 / N 分钟前 · N 小时前 · N 天前（Intl 复数与量词）/ ≥7 天回落日期 */
const activeAtText = (iso: string): string => {
    const resolved = resolveSessionActiveAt(iso)
    if (!resolved) return '—'
    if (resolved.kind === 'justNow') return t('settings.sessionJustNow')
    if (resolved.kind === 'yesterday') return t('settings.sessionYesterday')
    if (resolved.kind === 'date') {
        return resolved.date.toLocaleDateString(locale.value, DATE_OPTIONS)
    }
    return new Intl.RelativeTimeFormat(locale.value, { numeric: 'always' }).format(
        -resolved.amount,
        resolved.unit
    )
}

/**
 * 下线单个会话
 * @param session 会话
 */
const handleSignOutSession = async (session: UserSessionValueObject) => {
    const [isByCancel] = await NueConfirm({
        title: t('settings.sessionSignOutConfirmTitle'),
        content: t('settings.sessionSignOutConfirmContent', {
            device: deviceLabel(session.deviceType)
        }),
        confirmButtonText: t('settings.sessionSignOut'),
        cancelButtonText: t('common.cancel')
    })
    if (isByCancel) return
    const err = await props.userUseCase.signOutSession(session.id)
    if (err !== null) {
        NueMessage.error(t('settings.sessionSignOutFailed'))
        return
    }
    NueMessage.success(t('settings.sessionSignOutSuccess'))
    await loadSessions()
}

/**
 * 退出其他全部设备
 */
const handleSignOutOtherSessions = async () => {
    const [isByCancel] = await NueConfirm({
        title: t('settings.sessionSignOutOtherConfirmTitle'),
        content: t('settings.sessionSignOutOtherConfirmContent'),
        confirmButtonText: t('settings.sessionSignOutOther'),
        cancelButtonText: t('common.cancel')
    })
    if (isByCancel) return
    const err = await props.userUseCase.signOutOtherSessions()
    if (err !== null) {
        NueMessage.error(t('settings.sessionSignOutOtherFailed'))
        return
    }
    NueMessage.success(t('settings.sessionSignOutOtherSuccess'))
    await loadSessions()
}
</script>

<template>
    <div class="session-manager">
        <!-- 列表头：标题 + 刷新（保留节流 2s）；多于一台时才给「退出其他全部设备」 -->
        <header class="session-manager__head">
            <div class="session-manager__title-group">
                <span class="session-manager__title">{{ t('settings.sessionTitle') }}</span>
                <nue-button
                    icon="refresh"
                    theme="icon,ghost,small"
                    :title="t('settings.sessionRefresh')"
                    @click="handleRefreshSessions"
                />
            </div>
            <nue-button
                v-if="sessions.length > 1"
                theme="secondary,small"
                @click="handleSignOutOtherSessions"
            >
                {{ t('settings.sessionSignOutOther') }}
            </nue-button>
        </header>

        <!-- 三态统一走 LoadingError（AGENTS.md 界面原则 §6）：加载 / 失败 / 空（含需联网） -->
        <loading-error
            :loading="loading"
            :loading-message="t('settings.sessionLoading')"
            :error="loadFailed"
            :error-message="t('settings.sessionLoadFailed')"
            :empty="!loading && !loadFailed && (needsNetwork || orderedSessions.length === 0)"
        >
            <template #empty>
                <span class="session-manager__state">
                    {{
                        needsNetwork
                            ? t('settings.sessionNeedsNetwork')
                            : t('settings.sessionEmpty')
                    }}
                </span>
            </template>

            <ul class="session-list">
                <li
                    v-for="session in orderedSessions"
                    :key="session.id"
                    class="session-item"
                    :class="{ 'is-current': session.current }"
                    :data-session-id="session.id"
                    :data-session-current="String(!!session.current)"
                >
                    <nue-icon class="session-item__icon" :name="DEVICE_ICON" size="1.25rem" />

                    <div class="session-item__body">
                        <!-- 主行：设备名 + 「当前设备」文字标记 -->
                        <div class="session-item__main">
                            <span class="session-item__name">
                                {{ deviceLabel(session.deviceType) }}
                            </span>
                            <span v-if="session.current" class="session-item__current">
                                {{ t('settings.sessionCurrent') }}
                            </span>
                        </div>
                        <!-- 次行：地区 + IP（用间距分隔，不用连接符） -->
                        <div class="session-item__meta">
                            <span>{{ session.region || t('settings.sessionRegionUnknown') }}</span>
                            <span v-if="session.ip4">{{ session.ip4 }}</span>
                        </div>
                        <!-- 第三行：最近活跃（相对时间） + 登录时间（日期），title = 完整时间戳 -->
                        <div class="session-item__meta">
                            <span :title="fullText(session.updatedAt)">
                                {{ t('settings.sessionActiveAt') }}
                                {{ activeAtText(session.updatedAt) }}
                            </span>
                            <span :title="fullText(session.createdAt)">
                                {{ t('settings.sessionLoggedAt') }}
                                {{ dateText(session.createdAt) }}
                            </span>
                        </div>
                    </div>

                    <nue-button
                        v-if="!session.current"
                        class="session-item__action"
                        theme="text,small"
                        @click="handleSignOutSession(session)"
                    >
                        {{ t('settings.sessionSignOut') }}
                    </nue-button>
                </li>
            </ul>
        </loading-error>
    </div>
</template>

<style scoped>
.session-manager {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
}

.session-manager__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-sm);
}

.session-manager__title-group {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
}

.session-manager__title {
    color: var(--nue-primary-color-900);
    font-size: var(--nue-text-sm);
    font-weight: 600;
}

.session-manager__state {
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
}

/* 列表：项与项只用间距（12px）分开，不画线不画框 */
.session-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.session-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--nue-gap-sm);
    padding: 0.625rem 0.75rem;
    border-radius: var(--nue-primary-radius);
}

/* 当前设备：轻底色（三通道之一；位置置顶与文字标记见模板） */
.session-item.is-current {
    background: var(--nue-primary-color-100);
}

.session-item__icon {
    margin-top: 1px;
    color: var(--nue-secondary-text-color);
}

.session-item__body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.session-item__main {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--nue-gap-xs);
}

.session-item__name {
    color: var(--nue-primary-color-900);
    font-size: var(--nue-text-sm);
    font-weight: 600;
}

.session-item__current {
    padding: 0 var(--nue-padding-2xs);
    border-radius: var(--nue-radius-sm);
    background: var(--nue-primary-color-200);
    color: var(--nue-primary-color-900);
    font-size: var(--nue-text-xs);
    line-height: 1.6;
    white-space: nowrap;
}

.session-item__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--nue-gap-xs);
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    line-height: 1.4;
}

.session-item__action {
    align-self: start;
}
</style>