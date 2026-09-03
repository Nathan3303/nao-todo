export const TASK_REMIND_REPEAT_WAYS = [
    { label: '不重复', executeId: 'none' },
    { label: '每天', executeId: 'daily' },
    { label: '每周', executeId: 'weekly' }
    // 每月：仅隐藏 UI 选项，映射仍保留（兼容历史 remindRepeat='monthly' 数据的展示与回写，见 TASK_REMIND_REPEAT_MAP）
]

export const TASK_REMIND_REPEAT_DAYS = [
    { label: '周一', executeId: '1' },
    { label: '周二', executeId: '2' },
    { label: '周三', executeId: '3' },
    { label: '周四', executeId: '4' },
    { label: '周五', executeId: '5' },
    { label: '周六', executeId: '6' },
    { label: '周日', executeId: '7' }
]

export const TASK_REMIND_REPEAT_MAP: Record<string, number> = {
    none: 0,
    daily: 1,
    weekly: 2,
    // 保留映射：历史每月提醒数据还原/回写依赖，勿删（仅 UI 选项隐藏）
    monthly: 3
}

export const TASK_REMIND_REPEAT_REVERSE: Record<number, string> = {
    0: 'none',
    1: 'daily',
    2: 'weekly',
    // 保留映射：历史每月提醒数据回写依赖，勿删
    3: 'monthly'
}