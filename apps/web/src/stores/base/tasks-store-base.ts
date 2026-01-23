import type { Task, UpdateTaskOptions } from '@nao-todo/types'
import { ref } from 'vue'

const useTasksStoreBase = () => {
    // @state 任务列表 Map
    const tasks = ref<Map<Task['id'], Task>>(new Map())

    // @action 设置任务列表
    const setTasks = (newTasks: Task[]) => {
        tasks.value = new Map(newTasks.map((task) => [task.id, task]))
    }

    // @action 更新任务
    const updateTask = (taskId: Task['id'], updateOptions: UpdateTaskOptions) => {
        const task = tasks.value.get(taskId)
        if (task === undefined) {
            return
        }
        tasks.value.set(taskId, {
            ...task,
            ...updateOptions
        })
    }

    // @action 添加任务
    const addTask = (task: Task) => {
        const index = tasks.value.has(task.id)
        if (index) return
        tasks.value.set(task.id, task)
    }

    // @action 获取任务
    const getTask = (taskId: Task['id']) => {
        return tasks.value.get(taskId)
    }

    // @returns
    return {
        tasks,
        setTasks,
        updateTask,
        addTask,
        getTask
    }
}

export default useTasksStoreBase
export type TasksStoreBase = ReturnType<typeof useTasksStoreBase>
