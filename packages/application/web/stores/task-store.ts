import type { Task, UpdateTaskOptions } from '@nao-todo/types/viewobjects/task'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const useTaskStore = defineStore('TaskStore', () => {
    // @state 任务列表
    const tasks = ref<Task[]>([])

    // @action 设置任务列表
    function setTasks(newTasks: Task[]) {
        tasks.value = newTasks
    }

    // @action 更新任务
    function updateTask(taskId: Task['id'], updateOptions: UpdateTaskOptions) {
        const index = tasks.value.findIndex((task) => task.id === taskId)
        if (index === -1) {
            return
        }
        tasks.value[index] = {
            ...tasks.value[index],
            ...updateOptions
        }
    }

    // @returns
    return {
        list: computed(() => tasks.value),
        setTasks,
        updateTask,
    }
})

export default useTaskStore
