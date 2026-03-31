import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types'
import { ref } from 'vue'

const useTasksStoreBase = () => {
    // @state 任务列表 Map
    const tasks = ref<Map<TaskViewObject['id'], TaskViewObject>>(new Map())

    // @action 设置任务列表
    const setTasks = (newTasks: TaskViewObject[]) => {
        tasks.value = new Map(newTasks.map((task) => [task.id, task]))
    }

    // @action 更新任务
    const updateTask = (taskId: TaskViewObject['id'], updateOptions: UpdateTaskViewObject) => {
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
    const addTask = (task: TaskViewObject) => {
        const index = tasks.value.has(task.id)
        if (index) return
        tasks.value.set(task.id, task)
    }

    // @action 获取任务
    const getTask = (taskId: TaskViewObject['id']) => {
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
