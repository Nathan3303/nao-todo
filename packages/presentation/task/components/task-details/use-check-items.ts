import { type DialogManager, TASK_CREATOR_DIALOG_KEY, unwrapError } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'
import { TaskCheckItemHandler } from '../../handlers'
import type { useTaskDetailsStore } from '../../stores'
import type { TaskCheckItemViewObject, TaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from './context'

/**
 * 检查事项 composable
 * @description 管理任务检查事项的用例、处理程序、加载/重试、进度计算、排序及转任务。
 * @param taskDetailsStore 任务详情存储
 * @param dialogManager 弹窗管理器
 */
const useCheckItems = (
    taskDetailsStore: ReturnType<typeof useTaskDetailsStore>,
    dialogManager: DialogManager
) => {
    // @context 任务详情上下文
    const { taskCheckItemUseCase } = inject(TASK_DETAILS_PRE_CONTEXT_KEY)!

    // @handler 任务检查事项处理程序
    const checkItemHandler = new TaskCheckItemHandler(taskCheckItemUseCase)

    // @presetStates
    const {
        checkItemIdsCheckItems: checkItems,
        checkItemsLoading,
        checkItemsError
    } = storeToRefs(taskDetailsStore)

    // @state 当前任务 ID
    let currentTaskId: TaskViewObject['id'] | null = null

    /**
     * 计算检查事项进度
     */
    const checkItemProgress = computed(() => {
        const _e = checkItems.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '暂无检查事项'
        return { percentage, text }
    })

    /**
     * 加载检查事项
     * @param taskId 任务 ID
     */
    const loadCheckItems = async (taskId: TaskViewObject['id']) => {
        currentTaskId = taskId
        taskDetailsStore.setCheckItemsLoading(true)
        taskDetailsStore.setCheckItemsError('')
        const [, err] = await taskCheckItemUseCase.list(taskId)
        if (err !== null) {
            taskDetailsStore.setCheckItemsError('检查事项获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setCheckItemsLoading(false)
    }

    /**
     * 重试加载检查事项
     */
    const retryCheckItems = async () => {
        if (!currentTaskId) return
        await loadCheckItems(currentTaskId)
    }

    /**
     * 将检查事项转换为任务
     * @param checkItemId 检查事项 ID
     */
    const makeCheckItemToTask = (checkItemId: TaskCheckItemViewObject['id']) => {
        const checkItem = checkItems.value.find((checkItem) => checkItem.id === checkItemId)
        if (!checkItem) return
        dialogManager.open(TASK_CREATOR_DIALOG_KEY, {
            name: checkItem.name,
            state: checkItem.isDone ? 'done' : 'todo'
        })
    }

    /**
     * 排序检查事项
     * @param oeid 被拖拽检查事项 ID
     * @param teid 目标检查事项 ID
     * @param isUp 是否向上插入
     */
    const resortCheckItems = async (
        oeid: TaskCheckItemViewObject['id'],
        teid: TaskCheckItemViewObject['id'],
        isUp: boolean
    ) => {
        return await taskCheckItemUseCase.resort(oeid, teid, isUp)
    }

    // @returns
    return {
        checkItemHandler,
        checkItems,
        checkItemsLoading,
        checkItemsError,
        checkItemProgress,
        loadCheckItems,
        retryCheckItems,
        makeCheckItemToTask,
        resortCheckItems
    }
}

export default useCheckItems