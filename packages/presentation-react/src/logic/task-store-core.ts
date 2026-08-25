import type {
    TaskCheckItemStore,
    TaskCheckItemViewObject,
    TaskCommentStore,
    TaskCommentViewObject,
    TaskStore,
    TaskViewObject,
    UpdateTaskCheckItemViewObject,
    UpdateTaskCommentViewObject
} from '@nao-todo/domain-task'

/**
 * 任务相关 store core（订阅式，useSyncExternalStore 驱动 UI）
 * @description 实现 domain-task 的 TaskStore / TaskCheckItemStore / TaskCommentStore 接口。
 *              与 Web 端 Pinia 实现同构：store 持视图对象（应用层已由 converters 完成实体→VO 转换），
 *              更新走 usecase（经仓储持久化后回写 store），组件不直接改 store 数据。
 */
export class TaskStoreCore implements TaskStore, TaskCheckItemStore, TaskCommentStore {
    private taskMap = new Map<string, TaskViewObject>()
    private checkItemMap = new Map<string, TaskCheckItemViewObject>()
    private commentMap = new Map<string, TaskCommentViewObject>()
    private checkItemIdList: string[] = []
    private commentIdList: string[] = []
    private listeners = new Set<() => void>()
    // 子任务隔离区（与主列表 taskMap 完全隔离，避免 TaskUseCase.list 污染主视图）
    private subTaskMap = new Map<string, TaskViewObject>()
    private subTaskIdList: string[] = []
    // 快照缓存（useSyncExternalStore 要求 getSnapshot 返回稳定引用）
    private tasksSnapshot: TaskViewObject[] = []
    private checkItemsSnapshot: TaskCheckItemViewObject[] = []
    private commentsSnapshot: TaskCommentViewObject[] = []
    private subTasksSnapshot: TaskViewObject[] = []

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify = (): void => {
        this.tasksSnapshot = [...this.taskMap.values()]
        this.checkItemsSnapshot = this.checkItemIdList
            .map((id) => this.checkItemMap.get(id))
            .filter((item): item is TaskCheckItemViewObject => item !== undefined)
        this.commentsSnapshot = this.commentIdList
            .map((id) => this.commentMap.get(id))
            .filter((comment): comment is TaskCommentViewObject => comment !== undefined)
        this.subTasksSnapshot = this.subTaskIdList
            .map((id) => this.subTaskMap.get(id))
            .filter((task): task is TaskViewObject => task !== undefined)
        this.listeners.forEach((listener) => listener())
    }

    // --- 快照读取（供 useSyncExternalStore） ---

    getTasksSnapshot = (): TaskViewObject[] => this.tasksSnapshot

    getCheckItemsSnapshot = (): TaskCheckItemViewObject[] => this.checkItemsSnapshot

    getCommentsSnapshot = (): TaskCommentViewObject[] => this.commentsSnapshot

    getSubTasksSnapshot = (): TaskViewObject[] => this.subTasksSnapshot

    // --- TaskStore ---

    get tasks(): TaskViewObject[] {
        return this.tasksSnapshot
    }

    setTasks = (tasks: TaskViewObject[]): void => {
        this.taskMap = new Map(tasks.map((task) => [task.id, task]))
        this.notify()
    }

    addTask = (task: TaskViewObject): void => {
        this.taskMap.set(task.id, task)
        this.notify()
    }

    addTasks = (tasks: TaskViewObject[]): void => {
        for (const task of tasks) this.taskMap.set(task.id, task)
        this.notify()
    }

    updateTask = (id: string, update: Partial<TaskViewObject>): void => {
        const current = this.taskMap.get(id)
        if (!current) return
        this.taskMap.set(id, { ...current, ...update })
        this.notify()
    }

    getTask = (id: string): TaskViewObject | undefined => this.taskMap.get(id)

    removeTask = (id: string): void => {
        this.taskMap.delete(id)
        this.notify()
    }

    // --- TaskCheckItemStore ---

    get checkItems(): TaskCheckItemViewObject[] {
        return this.checkItemsSnapshot
    }

    setCheckItems = (items: TaskCheckItemViewObject[]): void => {
        this.checkItemMap = new Map(items.map((item) => [item.id, item]))
        this.checkItemIdList = items.map((item) => item.id)
        this.notify()
    }

    addCheckItem = (item: TaskCheckItemViewObject): void => {
        this.checkItemMap.set(item.id, item)
        this.checkItemIdList.push(item.id)
        this.notify()
    }

    updateCheckItem = (id: string, update: Partial<UpdateTaskCheckItemViewObject>): void => {
        const current = this.checkItemMap.get(id)
        if (!current) return
        this.checkItemMap.set(id, { ...current, ...update })
        this.notify()
    }

    updateCheckItems = (items: TaskCheckItemViewObject[]): void => {
        for (const item of items) this.checkItemMap.set(item.id, item)
        this.notify()
    }

    deleteCheckItem = (id: string): void => {
        this.checkItemMap.delete(id)
        this.checkItemIdList = this.checkItemIdList.filter((itemId) => itemId !== id)
        this.notify()
    }

    getCheckItem = (id: string): TaskCheckItemViewObject | undefined => this.checkItemMap.get(id)

    get checkItemIds(): string[] {
        return [...this.checkItemIdList]
    }

    setCheckItemIds = (ids: string[]): void => {
        this.checkItemIdList = [...ids]
        this.notify()
    }

    addCheckItemId = (id: string): void => {
        this.checkItemIdList.push(id)
        this.notify()
    }

    removeCheckItemId = (id: string): void => {
        this.checkItemIdList = this.checkItemIdList.filter((itemId) => itemId !== id)
        this.notify()
    }

    // --- TaskCommentStore ---

    get comments(): TaskCommentViewObject[] {
        return this.commentsSnapshot
    }

    setComments = (comments: TaskCommentViewObject[]): void => {
        this.commentMap = new Map(comments.map((comment) => [comment.id, comment]))
        this.commentIdList = comments.map((comment) => comment.id)
        this.notify()
    }

    addComment = (comment: TaskCommentViewObject): void => {
        this.commentMap.set(comment.id, comment)
        this.commentIdList.push(comment.id)
        this.notify()
    }

    updateComment = (id: string, update: Partial<UpdateTaskCommentViewObject>): void => {
        const current = this.commentMap.get(id)
        if (!current) return
        this.commentMap.set(id, { ...current, ...update })
        this.notify()
    }

    removeComment = (id: string): void => {
        this.commentMap.delete(id)
        this.commentIdList = this.commentIdList.filter((commentId) => commentId !== id)
        this.notify()
    }

    getComment = (id: string): TaskCommentViewObject | undefined => this.commentMap.get(id)

    get commentIds(): string[] {
        return [...this.commentIdList]
    }

    setCommentIds = (ids: string[]): void => {
        this.commentIdList = [...ids]
        this.notify()
    }

    addCommentId = (id: string): void => {
        this.commentIdList.push(id)
        this.notify()
    }

    removeCommentId = (id: string): void => {
        this.commentIdList = this.commentIdList.filter((commentId) => commentId !== id)
        this.notify()
    }

    // --- 子任务隔离区（SubTaskStoreAdapter 委托目标） ---

    get subTasks(): TaskViewObject[] {
        return this.subTasksSnapshot
    }

    setSubTasks = (tasks: TaskViewObject[]): void => {
        this.subTaskMap = new Map(tasks.map((task) => [task.id, task]))
        this.subTaskIdList = tasks.map((task) => task.id)
        this.notify()
    }

    addSubTask = (task: TaskViewObject): void => {
        this.subTaskMap.set(task.id, task)
        this.subTaskIdList.push(task.id)
        this.notify()
    }

    updateSubTask = (id: string, update: Partial<TaskViewObject>): void => {
        const current = this.subTaskMap.get(id)
        if (!current) return
        this.subTaskMap.set(id, { ...current, ...update })
        this.notify()
    }

    removeSubTask = (id: string): void => {
        this.subTaskMap.delete(id)
        this.subTaskIdList = this.subTaskIdList.filter((taskId) => taskId !== id)
        this.notify()
    }

    getSubTask = (id: string): TaskViewObject | undefined => this.subTaskMap.get(id)
}