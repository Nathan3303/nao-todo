import { prioritySNMap, prioritySNMapReverse, stateSNMap, stateSNMapReverse } from '../consts/tasks'

/**
 * 解析任务状态
 * @param state 任务状态字符串
 * @returns 任务状态数字
 */
export const parseTaskState = (stateString: string): number => {
    switch (stateString) {
        case 'todo':
            return stateSNMap.todo
        case 'in-progress':
            return stateSNMap['in-progress']
        case 'doing':
            return stateSNMap.doing
        case 'done':
            return stateSNMap.done
        default:
            return 0
    }
}

/**
 * 解析任务状态
 * @param stateNumber 任务状态数字
 * @returns 任务状态字符串
 */
export const parseTaskStateBackward = (stateNumber: number): string => {
    return stateSNMapReverse[stateNumber] || 'todo'
}

/**
 * 解析任务优先级
 * @param priorityString 任务优先级字符串
 * @returns 任务优先级数字
 */
export const parseTaskPriority = (priorityString: string): number => {
    switch (priorityString) {
        case 'low':
            return prioritySNMap.low
        case 'medium':
            return prioritySNMap.medium
        case 'high':
            return prioritySNMap.high
        default:
            return 0
    }
}

/**
 * 解析任务优先级
 * @param priorityNumber 任务优先级数字
 * @returns 任务优先级字符串
 */
export const parseTaskPriorityBackward = (priorityNumber: number): string => {
    return prioritySNMapReverse[priorityNumber] || 'low'
}

