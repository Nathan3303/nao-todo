import { useTaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { getTasksOptions2ValueObject, taskEntities2VOs } from './converters'
import type { GetTasksOptions, GoAsync, TaskVO } from '@nao-todo/types'
import dayjs from 'dayjs'
import { reactive, type Reactive, watch } from 'vue'

export type TaskAppStates = Reactive<{
    tasks: TaskVO[]
    taskMap: Map<string, number>
}>

export interface TaskApp {
    states: TaskAppStates
    list: (options?: GetTasksOptions) => GoAsync<TaskVO[]>
    remove: (id: string) => GoAsync<void>
    restore: (id: string) => GoAsync<void>
    // taskMap: ComputedRef<Map<string, TaskVO>>
    getByIdFromMap: (id: string) => TaskVO | undefined
}

export default (): TaskApp => {
    // @domain 任务域
    const taskDomain = useTaskDomain(useTaskRepository(getRequesterImpl()))

    // @state 任务列表以及映射
    const states = reactive<TaskAppStates>({
        tasks: [],
        taskMap: new Map()
    })

    // @method 获取标签列表
    const list = async (getOptions?: GetTasksOptions): GoAsync<TaskVO[]> => {
        // 1. 转换参数
        const listOptions = getTasksOptions2ValueObject(getOptions)
        // 2. 调用域服务
        const [taskEntities, err] = await taskDomain.list(listOptions)
        if (err !== null) {
            return [null, err]
        }
        // 3. 更新状态
        states.tasks = taskEntities2VOs(taskEntities)
        console.log(222, states.tasks)
        // 4. 返回
        return [states.tasks, null]
    }

    // @method 删除任务
    const remove = async (id: string): GoAsync<void> => {
        // 1. 调用域服务
        const err = await taskDomain.remove(id)
        if (err !== null) return err
        // 2. 删除任务
        const taskIdx = states.tasks.findIndex((task) => task.id === id)
        if (taskIdx !== -1) {
            states.tasks[taskIdx].deletedAt = dayjs().toISOString()
            states.tasks[taskIdx].isDeleted = true
        }
        // 4. 返回
        return null
    }

    // @method 恢复任务
    const restore = async (id: string): GoAsync<void> => {
        // 1. 调用域服务
        const err = await taskDomain.restore(id)
        if (err !== null) {
            return err
        }
        // 2. 恢复任务
        const taskIdx = states.tasks.findIndex((task) => task.id === id)
        if (taskIdx !== -1) {
            states.tasks[taskIdx].deletedAt = null
            states.tasks[taskIdx].isDeleted = false
        }
        // 4. 返回
        return null
    }

    /**
     * 任务 Mapper 以及相关方法
     * 主要提供 O(1) 时间复杂度的查询，用于在视图层快速获取任务详情
     * Computed 实现响应式变化
     */

    // @watch 监听 tasks 变化，更新 taskMap
    watch(
        () => states.tasks,
        (newList) => (states.taskMap = new Map(newList.map((item, index) => [item.id, index]))),
        { immediate: true }
    )

    // @method 根据 id 获取任务
    const getByIdFromMap = (id: string): TaskVO | undefined => {
        const index = states.taskMap.get(id)
        if (index === undefined) return void 0
        const task = states.tasks[index]
        if (task.isDeleted) return void 0
        return task
    }

    /**
     * 返回
     */
    return { states, list, remove, restore, getByIdFromMap }
}
