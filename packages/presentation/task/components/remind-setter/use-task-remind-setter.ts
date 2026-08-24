import { computed, nextTick, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import {
    TASK_REMIND_REPEAT_DAYS,
    TASK_REMIND_REPEAT_MAP,
    TASK_REMIND_REPEAT_REVERSE
} from './constants'
import type {
    TaskRemindData,
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
 * 提醒数据转换为设置器 VO 的提醒字段（纯函数）
 * @description 输入 TaskRemindData（remindAt/remindRepeat/remindTime/remindWeekdays），
 *              输出设置器初始值；空串视为无提醒（infrastructure 层存在 '' 兜底 null 的路径）
 * @param remind 提醒数据
 * @returns 设置器提醒字段
 */
export const remindDataToSetterVO = (remind: TaskRemindData): Partial<TaskRemindSetterVO> => {
    // 判断是否有提醒设置（remindAt/remindTime 任一缺失或为空均视为无提醒）
    const hasReminder =
        remind.remindTime != null &&
        remind.remindTime !== '' &&
        remind.remindAt != null &&
        remind.remindAt !== ''
    if (!hasReminder) {
        return {
            enabled: false,
            hour: DEFAULT_SETTER_VO.hour,
            minute: DEFAULT_SETTER_VO.minute,
            repeatWay: DEFAULT_SETTER_VO.repeatWay,
            repeatDays: [...DEFAULT_SETTER_VO.repeatDays]
        }
    }
    const repeatDays: TaskRemindSetterVO['repeatDays'] = [
        false,
        false,
        false,
        false,
        false,
        false,
        false
    ]
    const setter: Partial<TaskRemindSetterVO> = {
        enabled: true,
        hour: DEFAULT_SETTER_VO.hour,
        minute: DEFAULT_SETTER_VO.minute,
        // 重置重复天数，避免同一实例多次解析时残留上一次的选中状态
        repeatDays
    }
    // 处理提醒时间
    if (remind.remindTime) {
        const parts = remind.remindTime.split(':').map(Number)
        const h = parts[0]
        const m = parts[1]
        if (h !== undefined && m !== undefined && !isNaN(h) && !isNaN(m)) {
            setter.hour = h
            setter.minute = m
        }
    }
    // 处理重复方式
    if (remind.remindRepeat && remind.remindRepeat in TASK_REMIND_REPEAT_MAP) {
        const way = TASK_REMIND_REPEAT_MAP[remind.remindRepeat] as number | undefined
        if (way !== undefined && way > 0) setter.repeatWay = way
    }
    // 处理重复天数
    if (remind.remindWeekdays && remind.remindWeekdays.length > 0) {
        for (const day of remind.remindWeekdays) {
            const idx = day === 7 ? 6 : day - 1
            if (idx >= 0 && idx < 7) repeatDays[idx] = true
        }
    }
    return setter
}

/**
 * 任务提醒设置器 hook
 * @param props 任务提醒设置器属性
 * @param emits 任务提醒设置器事件
 */
const useTaskRemindSetter = (props: TaskRemindSetterProps, emits: TaskRemindSetterEmits) => {
    /**
     * 任务提醒设置器状态
     * @description repeatDays 需深拷贝：浅拷贝会与 DEFAULT_SETTER_VO 共享同一数组，
     *              组件每次重挂载（remindSetterKey++）都会继承上一次操作残留的选中状态
     */
    const vo = reactive<TaskRemindSetterVO>({
        ...DEFAULT_SETTER_VO,
        repeatDays: [...DEFAULT_SETTER_VO.repeatDays]
    })

    /**
     * 任务提醒设置器时间输入框显示值
     */
    const hourText = ref(pad(vo.hour))
    const minuteText = ref(pad(vo.minute))

    /**
     * 应用提醒数据到设置器显示值
     * @param remind 提醒数据
     */
    const applyRemindData = (remind: TaskRemindData) => {
        const reminder = remindDataToSetterVO(remind)
        vo.enabled = reminder.enabled ?? DEFAULT_SETTER_VO.enabled
        vo.hour = reminder.hour ?? DEFAULT_SETTER_VO.hour
        vo.minute = reminder.minute ?? DEFAULT_SETTER_VO.minute
        vo.repeatWay = reminder.repeatWay ?? DEFAULT_SETTER_VO.repeatWay
        vo.repeatDays.fill(false)
        const days = reminder.repeatDays
        if (days) {
            for (let i = 0; i < days.length; i++) {
                if (days[i]) vo.repeatDays[i] = true
            }
        }
    }

    /**
     * 任务视图转换为任务提醒设置器显示值
     * @param taskViewObject 任务视图
     */
    const taskViewObjectToSetterVO = (taskViewObject: TaskViewObject) => {
        applyRemindData({
            remindAt: taskViewObject.remindAt,
            remindRepeat: taskViewObject.remindRepeat as TaskRemindData['remindRepeat'],
            remindTime: taskViewObject.remindTime,
            remindWeekdays: taskViewObject.remindWeekdays
        })
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
     * @computed 重复方式文本计算
     */
    const repeatWayText = computed<string>(() => {
        switch (vo.repeatWay) {
            case 1:
                return '每天'
            case 2:
                return '每周'
            case 3:
                return '每月'
            default:
                return '不重复'
        }
    })

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
     * 监听提醒数据（无 task 场景，如任务创建器）初始化显示值
     * @description task 优先：详情面板等传 task 的场景由 task 初始化；创建器无 task，以 remind 兜底
     */
    watch(
        () => props.remind,
        (remind) => {
            if (props.task || !remind) return
            applyRemindData(remind)
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
            // 判断是否变更（基准归一化：task/remind 均缺失时按无提醒默认值比较，避免 undefined 恒不等导致永不触发）
            const isRemindAtSame =
                updateVO.remindAt === (props.task?.remindAt ?? props.remind?.remindAt ?? null)
            const isRemindRepeatSame =
                updateVO.remindRepeat ===
                (props.task?.remindRepeat ?? props.remind?.remindRepeat ?? 'none')
            const isRemindTimeSame =
                updateVO.remindTime === (props.task?.remindTime ?? props.remind?.remindTime ?? null)
            const isRemindWeekdaysSame =
                updateVO.remindWeekdays.toString() ===
                (props.task?.remindWeekdays ?? props.remind?.remindWeekdays ?? []).toString()
            // 全部字段与当前值相同（未变更）时不触发更新事件
            if (isRemindAtSame && isRemindRepeatSame && isRemindTimeSame && isRemindWeekdaysSame)
                return
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
        repeatWayText,
        handleRepeatWayDropdownExecute,
        handleRepeatDayDropdownExecute
    }
}

export default useTaskRemindSetter