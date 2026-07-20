import type { TaskViewObject } from '@nao-todo/application/task/viewobjects'
import { useMapperStoreBase } from '@nao-todo/shared'

export const useTasksStoreBase = () => {
    const {
        list: tasks,
        setList: setTasks,
        patchItem: updateTask,
        addItem: addTask,
        getItem: getTask,
        removeItem: removeTask,
        addItems: addTasks
    } = useMapperStoreBase<TaskViewObject>()

    // @returns
    return { tasks, setTasks, updateTask, addTask, addTasks, getTask, removeTask }
}

export type TasksStoreBase = ReturnType<typeof useTasksStoreBase>
