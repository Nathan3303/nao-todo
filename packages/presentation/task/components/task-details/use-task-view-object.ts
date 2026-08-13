import dayjs from 'dayjs'
import { ref, watch } from 'vue'
import { NueMessage } from 'nue-ui'
import {
    isGivenUpBy,
    isStarMarkedBy,
    type TaskUseCase,
    type TaskViewObject,
    type UpdateTaskViewObject
} from '@nao-todo/domain-task'
import { TaskDetailsPreContext } from './context'
import { translateTaskError } from '../../utils/error-message'
import { useTasksStore } from '../../stores'
import type { TaskDetailsViewObject } from './types'

/**
 * 主任务详情 composable
 * @description 负责拉取主任务详情并组装为任务详情面板视图对象（TaskDetailsViewObject）。
 * @param getTag 获取标签
 * @param getProjectName 获取项目名称
 */
const useTaskViewObject = (
    taskUseCase: TaskUseCase,
    getTag: TaskDetailsPreContext['getTag'],
    getProjectName: TaskDetailsPreContext['getProjectName']
) => {
    // @states
    const task = ref<TaskDetailsViewObject | null>(null) /** 任务视图对象 */
    const loading = ref(false) /** 加载状态 */
    const error = ref('') /** 错误信息 */

    // @state 上次从后端/store 同步的 name/description
    // @description 详情面板 textarea 的 v-model 直接写入本地 task.value（未 @change 提交前），
    //              用该值识别"编辑中未提交"字段，store 重装时保留，避免丢失输入
    const lastSyncedText = ref<{ name: string; description: string }>({ name: '', description: '' })

    // @store 任务列表 store（与列表视图共享同一 pinia 实例）
    const tasksStore = useTasksStore()

    /**
     * 组装任务详情视图对象
     * @description 将任务视图对象（TaskViewObject）组装为详情面板视图对象（TaskDetailsViewObject）
     * @param taskVO 任务视图对象
     */
    const assembleTaskViewObject = (taskVO: TaskViewObject): TaskDetailsViewObject => ({
        id: taskVO.id,
        userId: taskVO.userId,
        parentTaskId: taskVO.parentTaskId,
        name: taskVO.name,
        description: taskVO.description,
        state: taskVO.state,
        priority: taskVO.priority,
        startAt: taskVO.startAt,
        endAt: taskVO.endAt,
        projectId: taskVO.projectId,
        tags: taskVO.tags,
        createdAt: taskVO.createdAt,
        updatedAt: taskVO.updatedAt,
        deletedAt: taskVO.deletedAt,
        starMarkAt: taskVO.starMarkAt,
        givenUpAt: taskVO.givenUpAt,
        archivedAt: taskVO.archivedAt,
        remindAt: taskVO.remindAt,
        remindRepeat: taskVO.remindRepeat,
        remindTime: taskVO.remindTime,
        remindWeekdays: taskVO.remindWeekdays,
        // Others
        isDone: taskVO.state === 'done',
        isDeleted: taskVO.isDeleted,
        isStarMarked: taskVO.isStarMarked,
        isGivenUp: taskVO.isGivenUp,
        isArchived: taskVO.isArchived,
        tagList: taskVO.tags.map((tagId) => getTag(tagId)!).filter(Boolean),
        projectName: getProjectName(taskVO.projectId || '')
    })

    /**
     * 获取任务详情并转换为视图对象
     * @param taskId 任务 ID
     */
    const getTaskDetails = async (taskId?: TaskViewObject['id']) => {
        if (!taskId) {
            task.value = null
            return
        }
        error.value = ''
        loading.value = true
        const [_task, err] = await taskUseCase.get(taskId)
        loading.value = false
        if (err !== null) {
            error.value = translateTaskError(err)
            return
        }
        task.value = assembleTaskViewObject(_task)
        lastSyncedText.value = { name: _task.name, description: _task.description }
    }

    // @watch 订阅列表 store：任务在列表侧（看板/列表/表格）被更新时，同步刷新详情面板
    // 说明：详情面板数据源为 store（useTasksStore）单例，store 中当前任务变化即列表侧更新完成，
    //       重新组装即可联动 UI；latest 为 undefined（任务被移出视图）时不处理，避免误清空。
    // 注意：不能使用 deep: true —— Vue 的 watch job 触发条件 deep || hasChanged 在 deep 时恒真，
    //       回调每次赋值新 task.value 会反复触发源 effect 造成递归循环（Maximum recursive updates）。
    //       本 store 所有更新均为 map.set(id, 新对象) 整体替换，依赖引用变化即可正常触发。
    // 注意：字段级合并 —— name/description 由详情面板 textarea 的 v-model 直接写入本地 task.value
    //       （未 @change 提交前）；以 lastSyncedText 为基准识别"编辑中"字段并保留本地值，其余字段随 store 同步。
    watch(
        () => (task.value ? tasksStore.getTask(task.value.id) : undefined),
        (latest) => {
            if (!latest || !task.value) return
            const current = task.value
            const editedFields: Partial<TaskDetailsViewObject> = {}
            if (current.name !== lastSyncedText.value.name) editedFields.name = current.name
            if (current.description !== lastSyncedText.value.description)
                editedFields.description = current.description
            task.value = { ...assembleTaskViewObject(latest), ...editedFields }
            lastSyncedText.value = {
                name: editedFields.name ?? latest.name,
                description: editedFields.description ?? latest.description
            }
        }
    )

    /**
     * 更新任务详情
     * @param id 任务 ID
     * @param updateVO 任务更新视图对象
     * @returns 更新结果
     */
    const updateTaskDetails = async (id: TaskViewObject['id'], updateVO: UpdateTaskViewObject) => {
        if (!id) return
        const updateError = await taskUseCase.update(id, updateVO)
        if (updateError !== null) {
            NueMessage.error(translateTaskError(updateError))
            return
        }
        if (task.value === null) return
        // 同步派生字段（state/starMarkAt/givenUpAt/archivedAt/deletedAt 更新时，
        // isDone/isStarMarked/isGivenUp/isArchived/isDeleted 须随之刷新，否则 UI 图标不联动）
        task.value = {
            ...task.value,
            ...updateVO,
            updatedAt: dayjs().toISOString(),
            isDone: updateVO.state !== undefined ? updateVO.state === 'done' : task.value.isDone,
            isStarMarked:
                updateVO.starMarkAt !== undefined
                    ? isStarMarkedBy(updateVO.starMarkAt)
                    : task.value.isStarMarked,
            isGivenUp:
                updateVO.givenUpAt !== undefined
                    ? isGivenUpBy(updateVO.givenUpAt)
                    : task.value.isGivenUp,
            isArchived:
                updateVO.archivedAt !== undefined
                    ? Boolean(updateVO.archivedAt)
                    : task.value.isArchived,
            isDeleted:
                updateVO.deletedAt !== undefined
                    ? Boolean(updateVO.deletedAt)
                    : task.value.isDeleted
        }
    }

    /**
     * 删除任务
     * @param id 任务 ID
     */
    const deleteTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const deleteError = await taskUseCase.delete(id)
        if (deleteError !== null) return
        if (task.value === null) return
        task.value = { ...task.value, isDeleted: true, deletedAt: dayjs().toISOString() }
    }

    /**
     * 恢复任务
     * @param id 任务 ID
     */
    const restoreTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const restoreError = await taskUseCase.restore(id)
        if (restoreError !== null) return
        if (task.value === null) return
        task.value.isDeleted = false
        task.value.deletedAt = null
    }

    /**
     * 放弃任务
     * @param id 任务 ID
     */
    const giveUpTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const updateVO = { givenUpAt: dayjs().toISOString() }
        const giveUpError = await taskUseCase.update(id, updateVO)
        if (giveUpError !== null) {
            NueMessage.error(translateTaskError(giveUpError))
            return
        }
        if (task.value === null) return
        task.value = { ...task.value, ...updateVO, isGivenUp: true }
    }

    /**
     * 归档任务
     * @param id 任务 ID
     */
    const ungiveUpTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const updateVO = { givenUpAt: '' }
        const ungiveUpError = await taskUseCase.update(id, updateVO)
        if (ungiveUpError !== null) {
            NueMessage.error(translateTaskError(ungiveUpError))
            return
        }
        if (task.value === null) return
        task.value = { ...task.value, ...updateVO, isGivenUp: false }
    }

    // @returns
    return {
        task,
        loading,
        error,
        getTaskDetails,
        updateTaskDetails,
        deleteTask,
        restoreTask,
        giveUpTask,
        ungiveUpTask
    }
}

export default useTaskViewObject