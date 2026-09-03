<script setup lang="ts">
import { t, throttle } from '@nao-todo/shared'
import type { UserSessionValueObject, UserUseCase } from '@nao-todo/domain-identity'
import { NueConfirm, NueMessage } from 'nue-ui'
import { onMounted, ref } from 'vue'

defineOptions({ name: 'UserSessionManager' })
const props = defineProps<{ userUseCase: UserUseCase }>()

// @states
const sessions = ref<UserSessionValueObject[]>([])
const loading = ref(false)

/**
 * 加载会话列表
 */
const loadSessions = async () => {
    loading.value = true
    const [list, err] = await props.userUseCase.loadSessions()
    loading.value = false
    if (err !== null) {
        NueMessage.error(t('settings.sessionLoadFailed'))
        return
    }
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
 * RFC3339 时间本地化展示
 */
const formatTime = (time: string): string => new Date(time).toLocaleString()

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
    <nue-div theme="session-manager" vertical gap="0.75rem">
        <!-- 标题行：标题 + 刷新按钮居左，"退出其他全部设备"按钮居右（右上角） -->
        <nue-div align="center" justify="space-between">
            <nue-div align="center" gap="0.5rem">
                <nue-text>{{ t('settings.sessionTitle') }}</nue-text>
                <nue-button
                    icon="refresh"
                    theme="icon,ghost,small"
                    :title="t('settings.sessionRefresh')"
                    @click="handleRefreshSessions"
                />
            </nue-div>
            <nue-button
                v-if="sessions.length > 1"
                theme="secondary,small"
                @click="handleSignOutOtherSessions"
            >
                {{ t('settings.sessionSignOutOther') }}
            </nue-button>
        </nue-div>
        <nue-div v-if="loading" align="center" style="padding: 1rem">
            <nue-text size="var(--nue-text-sm)" color="gray">
                {{ t('settings.sessionLoading') }}
            </nue-text>
        </nue-div>
        <nue-empty v-else-if="!sessions.length" :description="t('settings.sessionEmpty')" />
        <nue-div v-else theme="session-list" vertical gap="0.5rem">
            <nue-div
                v-for="session in sessions"
                :key="session.id"
                theme="session-item"
                :data-current="session.current"
                align="center"
            >
                <nue-div vertical flex="1" style="min-width: 0" gap="0.25rem">
                    <nue-div align="center" gap="0.5rem">
                        <nue-text>{{ deviceLabel(session.deviceType) }}</nue-text>
                        <nue-badge
                            :hidden="!session.current"
                            size="small"
                            :value="t('settings.sessionCurrent')"
                        />
                    </nue-div>
                    <!-- 登录时间与最近活跃水平排列（同描述信息风格） -->
                    <nue-div align="center" gap="0.5rem">
                        <nue-text size=".75rem" color="gray">
                            {{ session.region || t('settings.sessionRegionUnknown') }} ·
                            {{ session.ip4 }}
                        </nue-text>
                        <nue-text size=".75rem" color="gray">
                            {{ t('settings.sessionLoggedAt') }}：{{ formatTime(session.createdAt) }}
                        </nue-text>
                        <nue-text size=".75rem" color="gray">
                            {{ t('settings.sessionActiveAt') }}：{{ formatTime(session.updatedAt) }}
                        </nue-text>
                    </nue-div>
                </nue-div>
                <nue-button
                    v-if="!session.current"
                    theme="small"
                    @click="handleSignOutSession(session)"
                >
                    {{ t('settings.sessionSignOut') }}
                </nue-button>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
/* 列表整体宽度有范围，不撑满父元素 */
.nue-div--session-list {
    max-width: min(32rem, 100%);
}

/* 列表项：无边框，padding 收紧降低高度 */
/* .nue-div--session-item {
    padding: 0.375rem 0.75rem;
    gap: var(--nue-gap-sm, 0.75rem);
} */
</style>