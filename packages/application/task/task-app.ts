import { useTaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { GetTasksOptions, GoAsync, TaskVO } from '@nao-todo/types'
import { ref, type ComputedRef, type Ref } from 'vue'
import { getTasksOptions2ValueObject, taskEntities2VOs } from './converters'
import useListMapper from '@nao-todo/infrastructure/hooks/use-list-mapper'
import dayjs from 'dayjs'

export interface TaskApp {
    tasks: Ref<TaskVO[]>
    list: (options?: GetTasksOptions) => GoAsync<TaskVO[]>
    remove: (id: string) => GoAsync<void>
    restore: (id: string) => GoAsync<void>
    taskMap: ComputedRef<Map<string, TaskVO>>
    getByIdFromMap: (id: string) => TaskVO | undefined
}

export default (): TaskApp => {
    // @domain 任务域
    const taskDomain = useTaskDomain(useTaskRepository(getRequesterImpl()))

    /**
     * 任务列表以及相关方法
     */

    // @state 任务列表
    const tasks = ref<TaskVO[]>([])

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
        tasks.value = taskEntities2VOs(taskEntities)
        // 4. 返回
        return [tasks.value, null]
    }

    // @method 删除任务
    const remove = async (id: string): GoAsync<void> => {
        // 1. 调用域服务
        const err = await taskDomain.remove(id)
        if (err !== null) return err
        // 2. 删除任务
        const taskIdx = tasks.value.findIndex((task) => task.id === id)
        if (taskIdx !== -1) {
            tasks.value[taskIdx].deletedAt = dayjs().toISOString()
            tasks.value[taskIdx].isDeleted = true
        }
        // 3. 删除映射
        removeFromMap(id)
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
        const taskIdx = tasks.value.findIndex((task) => task.id === id)
        if (taskIdx !== -1) {
            tasks.value[taskIdx].deletedAt = null
            tasks.value[taskIdx].isDeleted = false
        }
        // 3. 恢复映射
        addToMap(tasks.value[taskIdx])
        // 4. 返回
        return null
    }

    /**
     * 任务 Mapper 以及相关方法
     * 主要提供 O(1) 时间复杂度的查询，用于在视图层快速获取任务详情
     * Computed 实现响应式变化
     */

    // @hook useListMapper
    const {
        map: taskMap,
        get: getByIdFromMap,
        remove: removeFromMap,
        add: addToMap
    } = useListMapper(tasks)

    /**
     * 返回
     */
    return { tasks, list, remove, restore, taskMap, getByIdFromMap }
}
