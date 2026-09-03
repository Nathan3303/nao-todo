import { defineStore } from 'pinia'
import { useTasksStoreBase } from '../hooks'

export const useTasksStore = defineStore('TasksStore', () => {
    const { tasks, setTasks, updateTask, addTask, addTasks, getTask, removeTask } =
        useTasksStoreBase()

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