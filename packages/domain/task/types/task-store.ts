import type { TaskViewObject, UpdateTaskViewObject } from './viewobjects'

/**
 * 任务用例存储接口
 */
export interface TaskStore {
    /**
     * 设置任务列表
     * @param tasks 任务列表
     */
    setTasks(tasks: TaskViewObject[]): void

    /**
     * 更新任务
     * @param id 任务ID
     * @param updateTaskViewObject 更新任务视图对象
     */
    updateTask(id: TaskViewObject['id'], updateTaskViewObject: UpdateTaskViewObject): void

    /**
     * 添加任务
     * @param task 任务视图对象
     */
    addTask(task: TaskViewObject): void

    /**
     * 添加任务列表
     * @param tasks 任务列表
     */
    addTasks(tasks: TaskViewObject[]): void

    /**
     * 获取任务
     * @param id 任务ID
     * @returns 任务视图对象或undefined
     */
    getTask(id: TaskViewObject['id']): TaskViewObject | void

    /**
     * 删除任务
     * @param id 任务ID
     */
    removeTask(id: TaskViewObject['id']): void
}
