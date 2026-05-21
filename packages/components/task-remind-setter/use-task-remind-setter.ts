import { computed, reactive, watch } from 'vue'
// import { NueMessage } from 'nue-ui'
import dayjs from 'dayjs'
import { REPEAT_DAY_OPTIONS } from './constants'
import type {
    TaskRemindSetterEmits,
    TaskRemindSetterProps,
    TaskRemindSetterUpdateVO,
    TaskRemindSetterVO
} from './types'

const REMIND_REPEAT_MAP: Record<string, number> = {
    none: -1,
    daily: 0,
    weekly: 1,
    monthly: 2
}

const REMIND_REPEAT_REVERSE: Record<number, string> = {
    0: 'daily',
    1: 'weekly',
    2: 'monthly'
}

const useTaskRemindSetter = (props: TaskRemindSetterProps, emits: TaskRemindSetterEmits) => {
    const vo = reactive<TaskRemindSetterVO>({
        enabled: false,
        hour: 0,
        minute: 0,
        repeatWay: 0,
        repeatDays: [false, false, false, false, false, false, false]
    })

    // Initialize from props.task
    if (props.task) {
        const t = props.task
        const hasReminder = !!(t.remindRepeat && t.remindRepeat !== 'none')
        vo.enabled = hasReminder

        if (t.remindTime) {
            const parts = t.remindTime.split(':').map(Number)
            const h = parts[0]
            const m = parts[1]
            if (h !== undefined && m !== undefined && !isNaN(h) && !isNaN(m)) {
                vo.hour = h
                vo.minute = m
            }
        }

        if (t.remindRepeat && t.remindRepeat in REMIND_REPEAT_MAP) {
            const way = REMIND_REPEAT_MAP[t.remindRepeat] as number | undefined
            if (way !== undefined && way >= 0) vo.repeatWay = way
        }

        if (t.remindWeekdays && t.remindWeekdays.length > 0) {
            for (const day of t.remindWeekdays) {
                const idx = day === 7 ? 6 : day - 1
                if (idx >= 0 && idx < 7) vo.repeatDays[idx] = true
            }
        }
    }

    const hourText = computed({
        get: () => vo.hour.toString().padStart(2, '0'),
        set: (val) => (vo.hour = Number(val))
    })

    const minuteText = computed({
        get: () => vo.minute.toString().padStart(2, '0'),
        set: (val) => (vo.minute = Number(val))
    })

    const repeatDayText = computed(() => {
        return REPEAT_DAY_OPTIONS.filter((_item, idx) => vo.repeatDays[idx])
            .map((item) => item.label.slice(1, 2))
            .join('、')
    })

    const handleRepeatWayDropdownExecute = (executeId: string) => {
        if (executeId === 'reminder-repeat-day') {
            vo.repeatWay = 0
        } else if (executeId === 'reminder-repeat-week') {
            vo.repeatWay = 1
        }
    }

    const handleRepeatDayDropdownExecute = (executeId: string) => {
        const dayIndex = REPEAT_DAY_OPTIONS.findIndex((item) => item.executeId === executeId)
        if (dayIndex !== -1) {
            vo.repeatDays[dayIndex] = !vo.repeatDays[dayIndex]
        } else {
            console.error('未找到对应的重复天选项')
        }
    }

    // Validate and auto-set when enabling reminders
    watch(
        () => vo.enabled,
        (enabled) => {
            if (!enabled) return
            // 不允许在已过期的任务上启用提醒
            // if (props.date && dayjs(props.date).isBefore(dayjs())) {
            //     NueMessage.warn('请先选择一个合适的结束时间')
            //     vo.enabled = false
            //     return
            // }
            // Auto-set time to now when enabling reminders for the first time
            if (vo.hour === 0 && vo.minute === 0) {
                const now = dayjs()
                vo.hour = now.hour()
                vo.minute = now.minute()
            }
        }
    )

    // Build the update VO from current state
    const buildUpdateVO = (): TaskRemindSetterUpdateVO => {
        if (!vo.enabled) {
            return {
                remindAt: null,
                remindRepeat: 'none',
                remindTime: null,
                remindWeekdays: []
            }
        }

        const remindTime = `${vo.hour.toString().padStart(2, '0')}:${vo.minute.toString().padStart(2, '0')}`
        const remindRepeat = (REMIND_REPEAT_REVERSE[vo.repeatWay] ||
            'daily') as TaskRemindSetterUpdateVO['remindRepeat']

        const remindWeekdays: number[] = []
        if (vo.repeatWay === 1) {
            vo.repeatDays.forEach((selected, idx) => {
                if (selected) remindWeekdays.push(idx === 6 ? 7 : idx + 1)
            })
        }

        const now = dayjs()
        let candidate = now.hour(vo.hour).minute(vo.minute).second(0).millisecond(0)
        if (!candidate.isAfter(now)) {
            candidate = candidate.add(1, 'day')
        }

        // 每周重复：向前扫描匹配的星期几
        if (vo.repeatWay === 1 && remindWeekdays.length > 0) {
            for (let i = 0; i < 7; i++) {
                const dayjsDay = candidate.day()
                const idx = dayjsDay === 0 ? 6 : dayjsDay - 1
                if (vo.repeatDays[idx]) break
                candidate = candidate.add(1, 'day')
            }
        }

        const remindAt = candidate.toISOString()

        return { remindAt, remindRepeat, remindTime, remindWeekdays }
    }

    // Debounced emit
    let emitTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleEmit = () => {
        if (emitTimer) clearTimeout(emitTimer)
        emitTimer = setTimeout(() => {
            emits('update', buildUpdateVO())
        }, 200)
    }

    watch(
        () => [vo.enabled, vo.hour, vo.minute, vo.repeatWay, vo.repeatDays, props.date],
        () => scheduleEmit(),
        { deep: true }
    )

    return {
        vo,
        hourText,
        minuteText,
        repeatDayText,
        handleRepeatWayDropdownExecute,
        handleRepeatDayDropdownExecute
    }
}

export default useTaskRemindSetter

