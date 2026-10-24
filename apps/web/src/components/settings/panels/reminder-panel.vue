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
import { computed, ref, watch } from 'vue'
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
</script>

<template>
    <div class="sd-cat" data-settings-category="reminder">
        <section class="sd-group">
            <header class="sd-group__head">
                <h2 class="sd-group__title">{{ t('settings.ia.reminder.name') }}</h2>
                <p class="sd-group__desc">{{ t('settings.ia.reminder.desc') }}</p>
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
    </div>
</template>