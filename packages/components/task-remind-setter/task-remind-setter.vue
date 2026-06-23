<script setup lang="ts">
import useTaskRemindSetter from './use-task-remind-setter'
import { TASK_REMIND_REPEAT_WAYS, TASK_REMIND_REPEAT_DAYS } from './constants'
import type { TaskRemindSetterProps, TaskRemindSetterEmits } from './types'

defineOptions({ name: 'TaskRemindSetter' })
const props = defineProps<TaskRemindSetterProps>()
const emits = defineEmits<TaskRemindSetterEmits>()

const {
    vo,
    hourText,
    minuteText,
    onFocus,
    onHourInput,
    onMinuteInput,
    onHourBlur,
    onMinuteBlur,
    repeatDayText,
    handleRepeatWayDropdownExecute,
    handleRepeatDayDropdownExecute
} = useTaskRemindSetter(props, emits)
</script>

<template>
    <nue-div theme="task-remind-setter">
        <!-- 提醒开关 -->
        <nue-div
            justify="space-between"
            align="center"
            style="height: var(--nue-box-size-xs); padding: 0 var(--nue-padding-sm)"
        >
            <nue-text size="var(--nue-text-xs)">提醒</nue-text>
            <nue-switch v-model="vo.enabled" size="small" style="--nue-switch-height: 1rem" />
        </nue-div>
        <template v-if="vo.enabled">
            <!-- 提醒时间 -->
            <nue-div
                justify="space-between"
                align="center"
                style="height: var(--nue-box-size-xs); padding: 0 var(--nue-padding-sm)"
            >
                <nue-text size="var(--nue-text-xs)">提醒时间</nue-text>
                <nue-div theme="remind-time-setter" align="center">
                    <input
                        :value="hourText"
                        inputmode="numeric"
                        placeholder="00"
                        @focus="onFocus"
                        @input="onHourInput"
                        @blur="onHourBlur"
                    />
                    <nue-text weight="bold">:</nue-text>
                    <input
                        :value="minuteText"
                        inputmode="numeric"
                        placeholder="00"
                        @focus="onFocus"
                        @input="onMinuteInput"
                        @blur="onMinuteBlur"
                    />
                </nue-div>
            </nue-div>
            <!-- 提醒周期 -->
            <nue-dropdown
                style="width: 100%"
                size="small"
                placement="right-start"
                @execute="handleRepeatWayDropdownExecute"
                close-when-executed
            >
                <template #trigger="{ trigger }">
                    <nue-dropdown-item @click="trigger" size="small" use-suffix-icon>
                        提醒周期
                        <template #append>
                            <nue-text>{{
                                vo.repeatWay === 0 ? '不重复' : vo.repeatWay === 1 ? '每天' : '每周'
                            }}</nue-text>
                        </template>
                    </nue-dropdown-item>
                </template>
                <nue-dropdown-item
                    v-for="item in TASK_REMIND_REPEAT_WAYS"
                    :key="item.executeId"
                    :execute-id="item.executeId"
                    size="small"
                >
                    {{ item.label }}
                    <template #append>
                        <nue-icon name="check" v-if="vo.repeatWay === Number(item.executeId)" />
                    </template>
                </nue-dropdown-item>
            </nue-dropdown>
            <!-- 提醒日 - 只有在提醒周期为每周时才显示 -->
            <nue-dropdown
                v-if="vo.repeatWay === 2"
                style="width: 100%"
                size="small"
                placement="right-start"
                @execute="handleRepeatDayDropdownExecute"
            >
                <template #trigger="{ trigger }">
                    <nue-dropdown-item @click="trigger" size="small" use-suffix-icon>
                        提醒日
                        <template #append>
                            <nue-text style="margin-left: 1rem" :clamped="1">
                                {{ repeatDayText }}
                            </nue-text>
                        </template>
                    </nue-dropdown-item>
                </template>
                <nue-dropdown-item
                    v-for="(item, idx) in TASK_REMIND_REPEAT_DAYS"
                    :key="item.executeId"
                    :execute-id="item.executeId"
                    size="small"
                >
                    {{ item.label }}
                    <template #append>
                        <nue-icon name="check" v-if="vo.repeatDays[idx]" />
                    </template>
                </nue-dropdown-item>
            </nue-dropdown>
        </template>
    </nue-div>
</template>

<style scoped>
.nue-div--task-remind-setter {
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    align-items: stretch;
    width: 100%;
    color: var(--nue-primary-color-900);

    .nue-div--remind-time-setter {
        gap: var(--nue-gap-xs);
        font-size: var(--nue-text-sm);

        input {
            min-width: 0;
            width: calc(2 * var(--nue-text-sm));
            flex: 1;
            padding: 5px 0;
            margin: 0;
            border: 0;
            background-color: transparent;
            color: var(--nue-primary-color-900);
            outline: none;
            text-align: center;

            &:focus {
                outline: 1px solid var(--nue-border-color);
                border-radius: var(--nue-primary-radius);
                background-color: var(--nue-primary-color-100);
            }

            &[type='number'] {
                -moz-appearance: textfield;
                appearance: textfield;
            }

            /* 2. 针对 Chrome, Edge, Safari (WebKit/Blink 内核)：隐藏内部和外部箭头伪元素 */
            &[type='number']::-webkit-inner-spin-button,
            &[type='number']::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0; /* 防止隐藏后右侧残留空白或布局偏移 */
            }
        }
    }
}
</style>

