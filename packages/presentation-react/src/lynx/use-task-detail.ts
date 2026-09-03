import { useEffect, useState } from '@lynx-js/react'
import { useTaskStore } from '../hooks/use-task-store'
import { navCore } from '../logic/nav-core'
import type { TaskApp } from '../hooks/use-task-app'

/**
 * 任务详情逻辑 hook（屏幕渲染与业务交互分离）
 * @description 收敛描述编辑/检查事项/评论/子任务/删除恢复的全部状态与具名 handler；
 *              组件只读返回值渲染，JSX 不再内联调用 UseCase（DDD 红线）。
 * @param app 任务应用组合根（useTaskApp 返回值）
 * @param taskId 当前详情任务 ID
 */
export const useTaskDetail = (app: TaskApp, taskId: string) => {
    const { tasks, checkItems, comments, subTasks } = useTaskStore(app.taskStore)
    const task = tasks.find((item) => item.id === taskId)

    // 描述编辑态
    const [descEditing, setDescEditing] = useState(false)
    const [descDraft, setDescDraft] = useState('')
    // 检查事项/评论/子任务输入
    const [checkItemDraft, setCheckItemDraft] = useState('')
    const [commentDraft, setCommentDraft] = useState('')
    const [subTaskDraft, setSubTaskDraft] = useState('')

    // 进入详情：拉取任务详情 + 检查事项 + 评论 + 子任务（store.getTask 非响应式读取，仅做存在性检查）
    useEffect(() => {
        let cancelled = false
        void (async () => {
            if (taskId === '') return
            if (!app.taskStore.getTask(taskId)) {
                const [, err] = await app.taskUseCase.getTask(taskId)
                if (cancelled || err !== null) return
            }
            await app.taskUseCase.listCheckItems(taskId)
            await app.taskUseCase.listComments(taskId)
            await app.taskUseCase.listSubTasks(taskId)
        })()
        return () => {
            cancelled = true
        }
    }, [app.taskUseCase, app.taskStore, taskId])

    // --- 状态 / 优先级 ---

    const setTaskState = (state: string) => {
        if (!task) return
        void app.taskUseCase.updateTask(task.id, { state })
    }

    const setTaskPriority = (priority: string) => {
        if (!task) return
        void app.taskUseCase.updateTask(task.id, { priority })
    }

    // --- 描述 ---

    const startEditDescription = () => {
        if (!task) return
        setDescDraft(task.description ?? '')
        setDescEditing(true)
    }

    const cancelEditDescription = () => setDescEditing(false)

    const saveDescription = () => {
        if (!task) return
        void app.taskUseCase.updateTask(task.id, { description: descDraft })
        setDescEditing(false)
    }

    // --- 检查事项 ---

    // checked 即新状态（onChange 已传新值）
    const toggleCheckItem = (id: string, checked: boolean) => {
        void app.taskUseCase.updateCheckItem(id, { isDone: checked })
    }

    const removeCheckItem = (id: string) => {
        void app.taskUseCase.deleteCheckItem(id)
    }

    const addCheckItem = () => {
        if (!task) return
        const name = checkItemDraft.trim()
        if (name === '') return
        void app.taskUseCase.createCheckItem({ taskId: task.id, name }).then(() => {
            setCheckItemDraft('')
        })
    }

    // --- 评论 ---

    const addComment = () => {
        if (!task) return
        const content = commentDraft.trim()
        if (content === '') return
        void app.taskUseCase.createComment({ taskId: task.id, content }).then(() => {
            setCommentDraft('')
        })
    }

    // --- 子任务 ---

    const addSubTask = () => {
        if (!task) return
        const name = subTaskDraft.trim()
        if (name === '') return
        void app.taskUseCase.createSubTask(task.id, name).then(() => {
            setSubTaskDraft('')
        })
    }

    // checked 即新状态
    const toggleSubTask = (id: string, checked: boolean) => {
        void app.taskUseCase.updateSubTaskState(id, checked ? 'done' : 'todo')
    }

    const removeSubTask = (id: string) => {
        void app.taskUseCase.deleteSubTask(id)
    }

    // 子任务进度（已完成 x/y）
    const subTaskDone = subTasks.filter((sub) => sub.state === 'done').length

    // --- 删除 / 恢复 ---

    const deleteOrRestore = () => {
        if (!task) return
        if (task.isDeleted) {
            void app.taskUseCase.restoreTask(task.id)
        } else {
            void app.taskUseCase.deleteTask(task.id)
        }
        navCore.back()
    }

    return {
        task,
        checkItems,
        comments,
        subTasks,
        subTaskDone,
        setTaskState,
        setTaskPriority,
        descEditing,
        descDraft,
        setDescDraft,
        startEditDescription,
        cancelEditDescription,
        saveDescription,
        checkItemDraft,
        setCheckItemDraft,
        addCheckItem,
        toggleCheckItem,
        removeCheckItem,
        commentDraft,
        setCommentDraft,
        addComment,
        subTaskDraft,
        setSubTaskDraft,
        addSubTask,
        toggleSubTask,
        removeSubTask,
        deleteOrRestore
    }
}

export type TaskDetailLogic = ReturnType<typeof useTaskDetail>