import { stateSNMap, stateSNMapReverse } from '@nao-todo/domain-task'

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