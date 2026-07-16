import type { TaskCheckItemViewObject, UpdateTaskCheckItemViewObject } from './viewobjects'

/**
 * 任务检查项用例存储接口
 */
export interface TaskCheckItemStore {
    /**
     * 任务检查项列表
     */
    checkItems?: TaskCheckItemViewObject[]

    /**
     * 添加任务检查项
     * @param checkItem 任务检查项视图对象
     */
    addCheckItem: (checkItem: TaskCheckItemViewObject) => void

    /**
     * 获取任务检查项
     * @param id 任务检查项ID
     * @returns 任务检查项视图对象或undefined
     */
    getCheckItem: (id: TaskCheckItemViewObject['id']) => TaskCheckItemViewObject | undefined

    /**
     * 设置任务检查项列表
     * @param checkItems 任务检查项列表
     */
    setCheckItems: (checkItems: TaskCheckItemViewObject[]) => void

    /**
     * 设置任务检查项ID列表
     * @param ids 任务检查项ID列表
     */
    setCheckItemIds: (ids: TaskCheckItemViewObject['id'][]) => void

    /**
     * 添加任务检查项ID
     * @param id 任务检查项ID
     */
    addCheckItemId: (id: TaskCheckItemViewObject['id']) => void

    /**
     * 更新任务检查项
     * @param id 任务检查项ID
     * @param updateViewObject 更新任务检查项视图对象
     */
    updateCheckItem: (
        id: TaskCheckItemViewObject['id'],
        updateViewObject: UpdateTaskCheckItemViewObject
    ) => void

    /**
     * 更新任务检查项列表
     * @param newCheckItems 新的任务检查项列表
     */
    updateCheckItems: (newCheckItems: TaskCheckItemViewObject[]) => void

    /**
     * 删除任务检查项
     * @param id 任务检查项ID
     */
    deleteCheckItem: (id: TaskCheckItemViewObject['id']) => void
}


