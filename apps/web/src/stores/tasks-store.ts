import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types'

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
    const updateTask = (taskId: TaskViewObject['id'], updateViewObject: UpdateTaskViewObject) => {
        // 确保任务存在
        const idx = tasks.value.findIndex((task) => task.id === taskId)
        if (idx === -1) return
        const task = tasks.value[idx]
        if (!task) return
        // 解构排除 id，展开运算符合并更新
        const { ...updates } = updateViewObject
        Object.assign(task, updates)
    }

    // @action 添加任务
    const addTask = (task: TaskViewObject) => {
        const index = tasks.value.findIndex((t) => t.id === task.id)
        if (index !== -1) return
        tasks.value.push(task)
    }

    // @action 添加任务列表
    const addTasks = (tasks: TaskViewObject[]) => {
        tasks.forEach((task) => {
            addTask(task)
        })
    }

    // @action 获取任务
    const getTask = (taskId: TaskViewObject['id']) => {
        return tasksMap.value.get(taskId)
    }

    // @action 删除任务
    const removeTask = (taskId: TaskViewObject['id']) => {
        const idx = tasks.value.findIndex((task) => task.id === taskId)
        if (idx !== -1) {
            tasks.value.splice(idx, 1)
        }
    }

    // @returns
    return {
        tasks,
        setTasks,
        updateTask,
        addTask,
        addTasks,
        getTask,
        removeTask
    }
})

export default useTasksStore

