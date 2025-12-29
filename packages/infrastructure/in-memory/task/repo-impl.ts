import { TaskEntity } from '@nao-todo/domain/task'
import type {
    TaskInMemoryRepository,
    TaskInMemoryRepositoryStates
} from '@nao-todo/domain/task/repositories/task-in-memory'
import type { Go } from '@nao-todo/types'
import { reactive } from 'vue'

const useTaskInMemoryRepository = (): TaskInMemoryRepository => {
    // @states 任务状态
    const states = reactive<TaskInMemoryRepositoryStates>({
        tasks: [],
        taskMap: new Map()
    })

    // @method Remake task map
    const remakeTaskMap = () => {
        states.taskMap = new Map(states.tasks.map((item, idx) => [item.id, idx]))
    }

    // @method Get by id
    const getById = (taskId: string): Go<TaskEntity> => {
        const index = states.taskMap.get(taskId)
        if (index === undefined) {
            return [null, 'Task not found in memory']
        }
        const task = states.tasks[index]
        if (task === undefined) {
            return [null, 'Task not found in memory']
        }
        return [task, null]
    }

    // @method Add
    const add = (taskEntity: TaskEntity) => {
        states.tasks.push(taskEntity)
        remakeTaskMap()
    }

    // @method Update task
    const update = (taskId: string, taskEntity: TaskEntity) => {
        const index =
            states.taskMap.get(taskId) ?? states.tasks.findIndex((item) => item.id === taskId)
        if (index === -1) return
        states.tasks[index] = {
            ...states.tasks[index],
            ...taskEntity,
            id: states.tasks[index].id
        }
        remakeTaskMap()
    }

    // @method Remove task
    const remove = (taskId: string) => {
        const index =
            states.taskMap.get(taskId) ?? states.tasks.findIndex((item) => item.id === taskId)
        if (index === -1) return
        states.tasks[index].isDeleted = true
        remakeTaskMap()
    }

    // @method Restore task
    const restore = (taskId: string) => {
        const index =
            states.taskMap.get(taskId) ?? states.tasks.findIndex((item) => item.id === taskId)
        if (index === -1) return
        states.tasks[index].isDeleted = false
        remakeTaskMap()
    }

    // @method List task
    const list = () => {
        return states.tasks.filter((item) => !item.isDeleted)
    }

    // @method Set tasks
    const setTasks = (tasks: TaskEntity[]) => {
        states.tasks = tasks
        remakeTaskMap()
    }

    // @returns
    return { remakeTaskMap, getById, add, update, remove, restore, list, setTasks }
}

export default useTaskInMemoryRepository
