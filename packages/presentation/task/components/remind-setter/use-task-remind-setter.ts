import { computed, nextTick, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import {
    TASK_REMIND_REPEAT_DAYS,
    TASK_REMIND_REPEAT_MAP,
    TASK_REMIND_REPEAT_REVERSE
} from './constants'
import type {
    TaskRemindSetterEmits,
    TaskRemindSetterProps,
    TaskRemindSetterUpdateVO,
    TaskRemindSetterVO
} from './types'
import { pad, onFocus } from './utils'
import type { TaskViewObject } from '@nao-todo/domain-task'

const DEFAULT_SETTER_VO: TaskRemindSetterVO = {
    enabled: false,
    hour: 0,
    minute: 0,
    repeatWay: 0,
    repeatDays: [false, false, false, false, false, false, false]
}

/**
 * 任务提醒设置器 hook
 * @param props 任务提醒设置器属性
 * @param emits 任务提醒设置器事件
 */
const useTaskRemindSetter = (props: TaskRemindSetterProps, emits: TaskRemindSetterEmits) => {
    /**
     * 任务提醒设置器状态
     */
    const vo = reactive<TaskRemindSetterVO>({ ...DEFAULT_SETTER_VO })

    /**
     * 任务提醒设置器时间输入框显示值
     */
    const hourText = ref(pad(vo.hour))
    const minuteText = ref(pad(vo.minute))

    /**
     * 任务视图转换为任务提醒设置器显示值
     * @param taskViewObject 任务视图
     */
    const taskViewObjectToSetterVO = (taskViewObject: TaskViewObject) => {
        // 判断是否有提醒设置
        const hasReminder = taskViewObject.remindTime !== null && taskViewObject.remindAt !== null
        if (!hasReminder) {
            vo.enabled = false
            vo.hour = DEFAULT_SETTER_VO.hour
            vo.minute = DEFAULT_SETTER_VO.minute
            vo.repeatWay = DEFAULT_SETTER_VO.repeatWay
            vo.repeatDays = DEFAULT_SETTER_VO.repeatDays
            return
        }
        vo.enabled = true
        // 处理提醒时间
        if (taskViewObject.remindTime) {
            const parts = taskViewObject.remindTime.split(':').map(Number)
            const h = parts[0]
            const m = parts[1]
            if (h !== undefined && m !== undefined && !isNaN(h) && !isNaN(m)) {
                vo.hour = h
                vo.minute = m
            }
        }
        // 处理重复方式
        if (taskViewObject.remindRepeat && taskViewObject.remindRepeat in TASK_REMIND_REPEAT_MAP) {
            const way = TASK_REMIND_REPEAT_MAP[taskViewObject.remindRepeat] as number | undefined
            if (way !== undefined && way > 0) vo.repeatWay = way
        }
        // 处理重复天数
        if (taskViewObject.remindWeekdays && taskViewObject.remindWeekdays.length > 0) {
            for (const day of taskViewObject.remindWeekdays) {
                const idx = day === 7 ? 6 : day - 1
                if (idx >= 0 && idx < 7) vo.repeatDays[idx] = true
            }
        }
    }

    /**
     * 应用时间输入框值
     * @description 应用时间输入框输入的值，设置显示值并调用设置值回调
     * @param e 事件
     * @param displayRef 显示值引用
     * @param max 最大值
     * @param onSet 设置值回调
     */
    const applyTimeInput = (
        e: Event,
        displayRef: { value: string },
        max: number,
        onSet: (n: number) => void
    ) => {
        const input = e.target as HTMLInputElement
        const rawDigits = input.value.replace(/\D/g, '')
        const digits = rawDigits.slice(-2)
        let num = Number(digits) || 0
        if (num > max) num = max
        const val = num.toString().padStart(2, '0')
        input.value = val
        displayRef.value = val
        onSet(num)
        if (rawDigits.length >= 2) nextTick(() => input.select())
    }

    /**
     * 任务提醒设置器时间输入框获得焦点时选中所有内容
     * @description 任务提醒设置器时间输入框获得焦点时选中所有内容
     * @param e 事件
     */
    const onHourInput = (e: Event) => {
        applyTimeInput(e, hourText, 23, (n) => {
            vo.hour = n
        })
    }

    /**
     * 任务提醒设置器时间输入框获得焦点时选中所有内容
     * @description 任务提醒设置器时间输入框获得焦点时选中所有内容
     * @param e 事件
     */
    const onMinuteInput = (e: Event) => {
        applyTimeInput(e, minuteText, 59, (n) => {
            vo.minute = n
        })
    }

    /**
     * 任务提醒设置器时间输入框失去焦点时填充显示值
     * @description 任务提醒设置器时间输入框失去焦点时填充显示值
     */
    const onHourBlur = () => {
        hourText.value = pad(vo.hour)
    }

    /**
     * 任务提醒设置器时间输入框失去焦点时填充显示值
     * @description 任务提醒设置器时间输入框失去焦点时填充显示值
     */
    const onMinuteBlur = () => {
        minuteText.value = pad(vo.minute)
    }

    /**
     * 任务提醒设置器重复天数显示值
     */
    const repeatDayText = computed(() => {
        return TASK_REMIND_REPEAT_DAYS.filter((_item, idx) => vo.repeatDays[idx])
            .map((item) => item.label.slice(1, 2))
            .join('、')
    })

    /**
     * 任务提醒设置器重复方式下拉框执行事件
     * @param executeId 执行ID
     */
    const handleRepeatWayDropdownExecute = (executeId: string) => {
        switch (executeId) {
            case 'daily':
                vo.repeatWay = 1
                break
            case 'weekly':
                vo.repeatWay = 2
                break
            case 'monthly':
                vo.repeatWay = 3
                break
            default:
            case 'none':
                vo.repeatWay = 0
                break
        }
    }

    /**
     * 任务提醒设置器重复天数下拉框执行事件
     * @param executeId 执行ID
     */
    const handleRepeatDayDropdownExecute = (executeId: string) => {
        const dayIndex = Number(executeId) - 1
        if (dayIndex < 0 || dayIndex >= 7) {
            console.error('未找到对应的重复天选项')
            return
        }
        vo.repeatDays[dayIndex] = !vo.repeatDays[dayIndex]
    }

    /**
     * 构建任务提醒设置器更新VO
     */
    const buildUpdateVO = (): TaskRemindSetterUpdateVO => {
        // 关闭提醒功能，返回空的更新 VO
        if (!vo.enabled) {
            return {
                remindAt: null,
                remindRepeat: 'none',
                remindTime: null,
                remindWeekdays: []
            }
        }
        // 启用提醒功能，构建更新 VO
        const remindTime =
            vo.hour.toString().padStart(2, '0') + ':' + vo.minute.toString().padStart(2, '0')
        const remindRepeat = (TASK_REMIND_REPEAT_REVERSE[vo.repeatWay] ||
            'none') as TaskRemindSetterUpdateVO['remindRepeat']
        const remindWeekdays: number[] = []
        if (vo.repeatWay === 2) {
            vo.repeatDays.forEach((selected, idx) => {
                if (!selected) return
                remindWeekdays.push(idx + 1)
            })
        }
        const now = dayjs()
        let candidate = now.hour(vo.hour).minute(vo.minute).second(0).millisecond(0)
        if (!candidate.isAfter(now)) {
            candidate = candidate.add(1, 'day')
        }
        // 每周重复：向前扫描匹配的星期几
        if (vo.repeatWay === 2 && remindWeekdays.length > 0) {
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

    /**
     * 监听任务提醒设置器状态变化，更新显示值
     * @description 监听任务提醒设置器状态变化，更新显示值
     */
    watch(
        () => vo.hour,
        (h) => (hourText.value = pad(h))
    )

    /**
     * 监听任务提醒设置器状态变化，更新显示值
     * @description 监听任务提醒设置器状态变化，更新显示值
     */
    watch(
        () => vo.minute,
        (m) => (minuteText.value = pad(m))
    )

    /**
     * 当任务首次启用时，自动设置时间为当前时间
     * @watch vo.enabled
     */
    watch(
        () => vo.enabled,
        (enabled) => {
            if (!enabled) return
            if (vo.hour !== 0 || vo.minute !== 0) return
            // 自动设置时间为当前时间
            const now = dayjs()
            vo.hour = now.hour()
            vo.minute = now.minute()
        }
    )

    /**
     * 监听任务提醒设置器状态变化，更新显示值
     * @description 监听任务提醒设置器状态变化，更新显示值
     */
    watch(
        () => props.task,
        (newTask) => {
            if (!newTask) return
            taskViewObjectToSetterVO(newTask)
            // console.log(vo)
        },
        { deep: true, immediate: true }
    )

    /**
     * 监听任务提醒设置器状态变化，触发更新事件
     * @description 监听任务提醒设置器状态变化，触发更新事件
     */
    watch(
        () => [vo.enabled, vo.hour, vo.minute, vo.repeatWay, vo.repeatDays],
        () => {
            // 构建更新视图对象
            const updateVO = buildUpdateVO()
            // 判断是否变更
            const hasRemindAtChanged = updateVO.remindAt === props.task?.remindAt
            const hasRemindRepeatChanged = updateVO.remindRepeat === props.task?.remindRepeat
            const hasRemindTimeChanged = updateVO.remindTime === props.task?.remindTime
            const hasRemindWeekdaysChanged =
                updateVO.remindWeekdays.toString() === props.task?.remindWeekdays.toString()
            if (
                !hasRemindAtChanged &&
                !hasRemindRepeatChanged &&
                !hasRemindTimeChanged &&
                !hasRemindWeekdaysChanged
            )
                return
            console.log(
                !hasRemindAtChanged &&
                    !hasRemindRepeatChanged &&
                    !hasRemindTimeChanged &&
                    !hasRemindWeekdaysChanged
            )
            // 触发更新事件
            emits('update', updateVO)
        },
        { deep: true }
    )

    // 返回任务提醒设置器状态
    return {
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
    }
}

export default useTaskRemindSetter