<script setup lang="ts">
/**
 * 设置「提醒」分类面板（T535：从「应用设置」区搬入独立分类）
 * @description 系统通知 / 通知声音 / 免打扰时段 / 权限状态与一次性说明。
 *              状态与持久化全部经 `use-reminder-settings`（本地优先，先本地再入偏好队列）——
 *              本单**只换位置与版式**，判定、默认值、设备级 ack 与索权时机零改动。
 * @see docs/prds/2026-10-24-settings-ia.md（AC2 · AC5）
 * @see docs/prds/2026-10-24-reminder-settings.md（§五 R5–R8 · §七 AC1/AC9）
 */
import { t } from '@nao-todo/shared/locales'
import { normalizeQuietHours, type QuietHoursRange } from '@nao-todo/shared/reminder'
import { useDesktopShell } from '@/hooks'
import { computed, onMounted, ref, watch } from 'vue'
import { useReminderSettings } from '../app-setter/use-reminder-settings'

defineOptions({ name: 'SettingsReminderPanel' })

/** 首次开启免打扰时的默认时段（晚 10 点 – 早 8 点，最常见的诉求） */
const DEFAULT_QUIET_HOURS: QuietHoursRange = { start: '22:00', end: '08:00' }

const {
    settings,
    items,
    statusKey,
    noticeVisible,
    quietNow,
    canRequestPermission,
    setNotify,
    setSound,
    setQuietHours,
    requestPermission,
    ackNotice
} = useReminderSettings()

const notifyItem = computed(() => items.value[0])
const soundItem = computed(() => items.value[1])

/** 最近一次生效的时段（关闭免打扰再开启时恢复，不让用户重填） */
const lastRange = ref<QuietHoursRange>(settings.value.quietHours ?? DEFAULT_QUIET_HOURS)
const startText = ref(lastRange.value.start)
const endText = ref(lastRange.value.end)

watch(
    () => settings.value.quietHours,
    (range) => {
        if (!range) return
        lastRange.value = range
        startText.value = range.start
        endText.value = range.end
    }
)

const quietEnabled = computed({
    get: () => settings.value.quietHours !== null,
    set: (enabled: boolean) => setQuietHours(enabled ? lastRange.value : null)
})

/** 提交起止时间；非法（含起止相同）⇒ 回退到已保存值，不静默关掉免打扰 */
const commitQuietHours = (): void => {
    const range = normalizeQuietHours({ start: startText.value, end: endText.value })
    if (!range) {
        const saved = settings.value.quietHours ?? lastRange.value
        startText.value = saved.start
        endText.value = saved.end
        return
    }
    setQuietHours(range)
}

/* ===== 桌面常驻子块（D1：放在「提醒」分类下；Web 端 `isDesktop=false` ⇒ 整块不渲染） ===== */
const desktopShell = useDesktopShell()
const { isDesktop, status: shellStatus, loaded: shellLoaded } = desktopShell

onMounted(() => {
    if (isDesktop) void desktopShell.refresh()
})

/** 自启开关：以主进程**回读**为准（写入成功≠已生效，AC10） */
const autostartOn = computed(() => shellStatus.value.autostart === 'enabled')

/** 切换自启（回读结果由主进程带回，未生效则状态行显示「未生效」+ 重试） */
const toggleAutostart = (enabled: boolean): void => {
    void desktopShell.setAutostart(enabled)
}

/** 自启明确未生效（需重试）：`needs-approval` / `not-effective` */
const autostartNeedsRetry = computed(
    () =>
        shellStatus.value.autostart === 'needs-approval' ||
        shellStatus.value.autostart === 'not-effective'
)

/** 重试：重新写入一次「开启」意图并回读 */
const retryAutostart = (): void => {
    void desktopShell.setAutostart(true).then(() => desktopShell.refresh())
}

/**
 * 常驻状态四态（AC13；**颜色 + 符号 + 文字**三重可辨，不只靠颜色）
 * @description 优先级：环境不支持 > 需系统批准 > 可能不显示图标 > 已开启。
 *              自启「未生效」不改变常驻结论（进程仍常驻），由重试行单列说明。
 */
const statusView = computed(() => {
    if (shellStatus.value.tray === 'unsupported')
        return {
            key: 'settings.reminder.desktop.status.unsupported',
            tone: 'is-error',
            symbol: '×'
        }
    if (shellStatus.value.autostart === 'needs-approval')
        return {
            key: 'settings.reminder.desktop.status.needsApproval',
            tone: 'is-warn',
            symbol: '!'
        }
    if (shellStatus.value.tray === 'unconfirmed')
        return {
            key: 'settings.reminder.desktop.status.unconfirmed',
            tone: 'is-warn',
            symbol: '◐'
        }
    return { key: 'settings.reminder.desktop.status.available', tone: 'is-ok', symbol: '✓' }
})

/** 退出应用（托盘不可见时的唯一退出路径，RV5 / AC9②） */
const quitApp = (): void => {
    desktopShell.quit()
}
</script>

<template>
    <div class="sd-cat" data-settings-category="reminder">
        <section class="sd-group">
            <header class="sd-group__head">
                <h2 class="sd-group__title">{{ t('settings.ia.reminder.name') }}</h2>
                <p class="sd-group__desc" data-settings-desc>
                    {{ t('settings.ia.reminder.desc') }}
                </p>
            </header>

            <!-- 系统通知 -->
            <div class="sd-row" data-setting-id="notify">
                <span class="sd-row__label">{{ t(notifyItem.labelKey) }}</span>
                <nue-switch
                    :model-value="settings.notify"
                    size="small"
                    role="switch"
                    :aria-checked="settings.notify"
                    :aria-label="t(notifyItem.labelKey)"
                    :disabled="notifyItem.disabled"
                    tabindex="0"
                    @update:model-value="(value: boolean) => setNotify(value)"
                    @keydown.enter.prevent="setNotify(!settings.notify)"
                    @keydown.space.prevent="setNotify(!settings.notify)"
                />
            </div>

            <!-- 通知声音（系统通知不可用时置灰并说明） -->
            <div class="sd-row" data-setting-id="sound">
                <div class="sd-row__text">
                    <span class="sd-row__label">{{ t(soundItem.labelKey) }}</span>
                    <p v-if="soundItem.hintKey" class="sd-row__hint">
                        {{ t(soundItem.hintKey) }}
                    </p>
                </div>
                <nue-switch
                    :model-value="settings.sound"
                    size="small"
                    role="switch"
                    :aria-checked="settings.sound"
                    :aria-label="t(soundItem.labelKey)"
                    :disabled="soundItem.disabled"
                    tabindex="0"
                    @update:model-value="(value: boolean) => setSound(value)"
                    @keydown.enter.prevent="setSound(!settings.sound)"
                    @keydown.space.prevent="setSound(!settings.sound)"
                />
            </div>

            <!-- 免打扰（开关 + 时段输入 + 生效中提示，同一行内纵向堆叠） -->
            <div class="sd-row sd-row--stack" data-setting-id="quiet-hours">
                <div class="sd-row__line">
                    <span class="sd-row__label">{{ t('settings.reminder.quietHours') }}</span>
                    <nue-switch
                        v-model="quietEnabled"
                        size="small"
                        role="switch"
                        :aria-checked="quietEnabled"
                        :aria-label="t('settings.reminder.quietHours')"
                        tabindex="0"
                        @keydown.enter.prevent="quietEnabled = !quietEnabled"
                        @keydown.space.prevent="quietEnabled = !quietEnabled"
                    />
                </div>
                <div v-if="quietEnabled" class="sd-quiet-hours">
                    <label class="sd-quiet-hours__field">
                        <span class="sd-row__hint">{{
                            t('settings.reminder.quietHoursStart')
                        }}</span>
                        <input
                            v-model="startText"
                            type="time"
                            :aria-label="t('settings.reminder.quietHoursStart')"
                            @change="commitQuietHours"
                        />
                    </label>
                    <label class="sd-quiet-hours__field">
                        <span class="sd-row__hint">{{ t('settings.reminder.quietHoursEnd') }}</span>
                        <input
                            v-model="endText"
                            type="time"
                            :aria-label="t('settings.reminder.quietHoursEnd')"
                            @change="commitQuietHours"
                        />
                    </label>
                </div>
                <p v-if="quietNow" class="sd-row__hint">
                    {{ t('settings.reminder.quietNow') }}
                </p>
            </div>

            <!-- 权限常驻状态（三态可辨：文字 + 操作入口，不只靠颜色） -->
            <div class="sd-row sd-row--stack" data-setting-id="permission">
                <div class="sd-row__line">
                    <span class="sd-row__label">{{ t('settings.ia.permission.title') }}</span>
                    <nue-button
                        v-if="canRequestPermission"
                        size="small"
                        theme="text"
                        @click="requestPermission"
                    >
                        {{ t('settings.reminder.permission.enable') }}
                    </nue-button>
                </div>
                <p class="sd-row__hint">{{ t(statusKey) }}</p>
                <!-- 一次性设备级说明（重开不再出现） -->
                <div v-if="noticeVisible" class="sd-permission-notice">
                    <p class="sd-row__hint">{{ t('settings.reminder.permission.hint') }}</p>
                    <nue-button size="small" theme="text" @click="ackNotice">
                        {{ t('dialog.taskReminder.confirm') }}
                    </nue-button>
                </div>
            </div>
        </section>

        <!-- 桌面常驻（D1：与提醒同源；桌面端专属，Web 端不渲染） -->
        <section v-if="isDesktop" class="sd-group" data-setting-id="desktop-residency">
            <header class="sd-group__head">
                <h3 class="sd-group__title">{{ t('settings.reminder.desktop.title') }}</h3>
                <p class="sd-group__desc">{{ t('settings.reminder.desktop.hint') }}</p>
            </header>

            <!-- 开机自启（开关；状态以系统回读为准） -->
            <div class="sd-row" data-setting-id="desktop-autostart">
                <span class="sd-row__label">{{ t('settings.reminder.desktop.autostart') }}</span>
                <nue-switch
                    :model-value="autostartOn"
                    size="small"
                    role="switch"
                    :aria-checked="autostartOn"
                    :aria-label="t('settings.reminder.desktop.autostart')"
                    tabindex="0"
                    @update:model-value="(value: boolean) => toggleAutostart(value)"
                    @keydown.enter.prevent="toggleAutostart(!autostartOn)"
                    @keydown.space.prevent="toggleAutostart(!autostartOn)"
                />
            </div>

            <!-- 常驻状态（颜色 + 符号 + 文字三重可辨） -->
            <div v-if="shellLoaded" class="sd-row sd-row--stack" data-setting-id="desktop-status">
                <div class="sd-row__line">
                    <span class="sd-desktop-status" :class="statusView.tone" role="status">
                        <span class="sd-desktop-status__symbol" aria-hidden="true">{{
                            statusView.symbol
                        }}</span>
                        <span>{{ t(statusView.key) }}</span>
                    </span>
                    <nue-button
                        v-if="autostartNeedsRetry"
                        size="small"
                        theme="text"
                        @click="retryAutostart"
                    >
                        {{ t('settings.reminder.desktop.retry') }}
                    </nue-button>
                </div>
                <p v-if="autostartNeedsRetry" class="sd-row__hint">
                    {{ t('settings.reminder.desktop.status.notEffective') }}
                </p>
            </div>

            <!-- 退出入口（托盘不可见时也必须可达，不得让用户无退出路径） -->
            <div class="sd-row sd-row--end" data-setting-id="desktop-quit">
                <button type="button" class="sd-row__action" @click="quitApp">
                    {{ t('settings.reminder.desktop.quit') }}
                </button>
            </div>
        </section>
    </div>
</template>