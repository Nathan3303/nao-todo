import type { Task, UpdateTaskOptions } from '@nao-todo/types/viewobjects/task'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const useTasksStore = defineStore('TasksStore', () => {
    // @state 任务列表
    const tasks = ref<Task[]>([])

    // @computed 任务列表 Map
    const tasksMap = computed(() => {
        return new Map(tasks.value.map((task) => [task.id, task]))
    })

    // @action 设置任务列表
    const setTasks = (newTasks: Task[]) => {
        tasks.value = newTasks
    }

    // @action 更新任务
    const updateTask = (taskId: Task['id'], updateOptions: UpdateTaskOptions) => {
        const idx = tasks.value.findIndex((task) => task.id === taskId)
        if (idx === -1) return
        tasks.value[idx] = {
            ...tasks.value[idx],
            ...updateOptions
        }
    }

    // @action 添加任务
    const addTask = (task: Task) => {
        const index = tasks.value.findIndex((t) => t.id === task.id)
        if (index !== -1) return
        tasks.value.push(task)
    }

    // @action 获取任务
    const getTask = (taskId: Task['id']) => {
        return tasksMap.value.get(taskId)
    }

    // @returns
    return { list: tasks, setTasks, updateTask, addTask, getTask }
})

export default useTasksStore
