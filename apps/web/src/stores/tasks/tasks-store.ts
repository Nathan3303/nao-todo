import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types/viewobjects/task'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const useTasksStore = defineStore('TasksStore', () => {
    // @state 任务列表
    const tasks = ref<TaskViewObject[]>([])

    // @computed 任务列表 Map
    const tasksMap = computed(() => {
        return new Map(tasks.value.map((task) => [task.id, task]))
    })

    // @action 设置任务列表
    const setTasks = (newTasks: TaskViewObject[]) => {
        tasks.value = newTasks
    }

    // @action 更新任务
    const updateTask = (taskId: TaskViewObject['id'], updateOptions: UpdateTaskViewObject) => {
        const idx = tasks.value.findIndex((task) => task.id === taskId)
        if (idx === -1) return
        tasks.value[idx] = {
            ...tasks.value[idx],
            ...updateOptions
        }
    }

    // @action 添加任务
    const addTask = (task: TaskViewObject) => {
        const index = tasks.value.findIndex((t) => t.id === task.id)
        if (index !== -1) return
        tasks.value.push(task)
    }

    // @action 获取任务
    const getTask = (taskId: TaskViewObject['id']) => {
        return tasksMap.value.get(taskId)
    }

    // @returns
    return { list: tasks, setTasks, updateTask, addTask, getTask }
})

export default useTasksStore
