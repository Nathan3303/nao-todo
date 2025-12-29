import { useTaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { getTasksOptions2ValueObject, taskEntities2VOs } from './converters'
import type { CreateTaskVO, GetTasksOptions, GoAsync, TaskVO } from '@nao-todo/types'
import dayjs from 'dayjs'
import { type ComputedRef, reactive, type Reactive, watch } from 'vue'
import { useListMapperV2 } from '@nao-todo/infrastructure/hooks/use-list-mapper'

export type TaskAppStates = Reactive<{
    tasks: TaskVO[]
    taskMap: Map<string, number>
}>

export interface TaskApp {
    states: TaskAppStates
    list: (options?: GetTasksOptions) => GoAsync<TaskVO[]>
    remove: (id: string) => GoAsync<void>
    restore: (id: string) => GoAsync<void>
    create: (createVO: CreateTaskVO) => GoAsync<TaskVO>
    getByIdFromMap: (id: string) => TaskVO | undefined
    computedGetByIdFromMap: (id: string) => ComputedRef<TaskVO | undefined>
}

export default (): TaskApp => {
    // @domain 任务域
    const taskDomain = useTaskDomain(useTaskRepository(getRequesterImpl()))

    // @state 任务列表以及映射
    const states = reactive<TaskAppStates>({
        tasks: [],
        taskMap: new Map()
    })

    /**
     * Tasks 相关方法
     */

    // @method 获取标签列表
    const list = async (getOptions?: GetTasksOptions): GoAsync<TaskVO[]> => {
        // 1. 转换参数
        const listOptions = getTasksOptions2ValueObject(getOptions)
        // 2. 获取后端数据
        const [taskEntities, err] = await taskDomain.list(listOptions)
        if (err !== null) {
            return [null, err]
        }
        // 3. 更新状态
        const taskVOs = taskEntities2VOs(taskEntities)
        states.tasks = taskVOs
        // 4. 返回
        return [taskVOs, null]
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

    // @method 创建任务
    const create = async (createVO: CreateTaskVO): GoAsync<TaskVO> => {
        // 1. 调用域服务
        const [taskEntity, err] = await taskDomain.create(createVO)
        if (err !== null) {
            return [null, err]
        }
        // 2. 更新状态
        const taskVO = taskEntities2VOs([taskEntity])[0]
        states.tasks.push(taskVO)
        // 3. 返回
        return [taskVO, null]
    }

    /**
     * TaskMap 相关方法
     */

    // @hook
    const { makeMap, getById, useComputedGetter } = useListMapperV2<TaskVO>()

    // @watch 监听 tasks 变化，更新 taskMap
    watch(
        () => states.tasks,
        (newList) => makeMap(newList),
        { immediate: true }
    )

    /**
     * 返回
     */
    return {
        states,
        list,
        remove,
        restore,
        create,
        getByIdFromMap: getById,
        computedGetByIdFromMap: useComputedGetter
    }
}
