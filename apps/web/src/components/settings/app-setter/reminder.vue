<script setup lang="ts">
/**
 * 设置区「提醒」小节（T531 · AC1 / AC9 · C3）
 * @description 并入既有「应用设置」区块（不新增第 4 个 Tab）：系统通知 / 通知声音 / 免打扰时段
 *              + 权限三态常驻状态 + 一次性设备级说明（说人话，不露内部键名）。
 *              状态与持久化全部经 `use-reminder-settings`（本地优先，先本地再入偏好队列）。
 * @see docs/prds/2026-10-24-reminder-settings.md（§三 范围 1/5 · §七 AC1/AC9）
 */
import { t } from '@nao-todo/shared/locales'
import { normalizeQuietHours, type QuietHoursRange } from '@nao-todo/shared/reminder'
import { computed, ref, watch } from 'vue'
import { useReminderSettings } from './use-reminder-settings'

defineOptions({ name: 'SettingsAppReminder' })

/** 首次开启免打扰时的默认时段（晚 10 点 – 早 8 点，最常见的诉求） */
const DEFAULT_QUIET_HOURS: QuietHoursRange = { start: '22:00', end: '08:00' }

const {
    settings,
    items,
    status,
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
    <nue-div theme="reminder-settings">
        <nue-div theme="title-wrapper">
            <nue-text theme="title">{{ t('settings.reminder.title') }}</nue-text>
        </nue-div>

        <!-- 系统通知 -->
        <nue-div theme="row">
            <nue-text>{{ t(notifyItem.labelKey) }}</nue-text>
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
        </nue-div>

        <!-- 通知声音（系统通知不可用时置灰并说明） -->
        <nue-div theme="row">
            <nue-text>{{ t(soundItem.labelKey) }}</nue-text>
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
        </nue-div>
        <nue-text v-if="soundItem.hintKey" theme="hint">
            {{ t(soundItem.hintKey) }}
        </nue-text>

        <!-- 免打扰 -->
        <nue-div theme="row">
            <nue-text>{{ t('settings.reminder.quietHours') }}</nue-text>
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
        </nue-div>
        <nue-div v-if="quietEnabled" theme="quiet-hours">
            <label class="quiet-hours__field">
                <nue-text theme="hint">{{ t('settings.reminder.quietHoursStart') }}</nue-text>
                <input
                    v-model="startText"
                    type="time"
                    :aria-label="t('settings.reminder.quietHoursStart')"
                    @change="commitQuietHours"
                />
            </label>
            <label class="quiet-hours__field">
                <nue-text theme="hint">{{ t('settings.reminder.quietHoursEnd') }}</nue-text>
                <input
                    v-model="endText"
                    type="time"
                    :aria-label="t('settings.reminder.quietHoursEnd')"
                    @change="commitQuietHours"
                />
            </label>
        </nue-div>
        <nue-text v-if="quietNow" theme="hint">{{ t('settings.reminder.quietNow') }}</nue-text>

        <!-- 权限常驻状态（三态可辨：文字 + 操作入口，不只靠颜色） -->
        <nue-div theme="row">
            <nue-text theme="hint">{{ t(statusKey) }}</nue-text>
            <nue-button
                v-if="canRequestPermission"
                size="small"
                theme="text"
                @click="requestPermission"
            >
                {{ t('settings.reminder.permission.enable') }}
            </nue-button>
        </nue-div>

        <!-- 一次性设备级说明（重开不再出现） -->
        <nue-div v-if="noticeVisible" theme="notice">
            <nue-text theme="hint">{{ t('settings.reminder.permission.hint') }}</nue-text>
            <nue-button size="small" theme="text" @click="ackNotice">
                {{ t('dialog.taskReminder.confirm') }}
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--reminder-settings {
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    align-items: stretch;

    .nue-div--title-wrapper {
        flex-direction: column;
        gap: 0.25rem;

        .nue-text--title {
            font-size: var(--nue-text-df);
        }
    }

    .nue-div--row {
        min-height: 2.5rem;
        align-items: center;
        justify-content: space-between;
        gap: var(--nue-gap-sm);
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-800);
    }

    .nue-text--hint {
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-500);
        line-height: 1.5;
    }

    .nue-div--quiet-hours {
        gap: var(--nue-gap-sm);
        flex-wrap: wrap;

        .quiet-hours__field {
            display: flex;
            flex-direction: column;
            gap: var(--nue-gap-2xs);
            min-width: 8rem;
            flex: 1;

            input {
                box-sizing: border-box;
                width: 100%;
                min-height: 2rem;
                padding: 0 var(--nue-padding-xs);
                border: 1px solid var(--nue-border-color);
                border-radius: var(--nue-primary-radius);
                background-color: transparent;
                color: var(--nue-primary-color-800);
                font-size: var(--nue-text-sm);
                font-family: inherit;
                outline: none;

                &:focus-visible {
                    outline: 2px solid var(--nue-primary-color-500);
                    outline-offset: 1px;
                }
            }
        }
    }

    .nue-div--notice {
        flex-direction: column;
        gap: var(--nue-gap-xs);
        align-items: flex-start;
        padding: var(--nue-padding-xs) var(--nue-padding-sm);
        border-radius: var(--nue-primary-radius);
        background-color: var(--nue-primary-color-100);
    }
}
</style>