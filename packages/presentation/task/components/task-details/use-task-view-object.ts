import dayjs from 'dayjs'
import { ref, watch } from 'vue'
import { NueMessage } from 'nue-ui'
import type { GoError } from '@nao-todo/shared'
import {
    isGivenUpBy,
    isStarMarkedBy,
    type TaskUpdateOrigin,
    type TaskUseCase,
    type TaskViewObject,
    type UpdateTaskViewObject
} from '@nao-todo/domain-task'
import { TaskDetailsPreContext } from './context'
import { translateTaskError } from '../../utils/error-message'
import { isArchivedReadOnlyError } from '../../archive-gate'
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

    // @state 上次**已持久化**的 name/description（未保存的编辑**不得**推进它）
    // @description 详情面板 textarea 的 v-model 直接写入本地 task.value（未 @change 提交前），
    //              以该基准识别「编辑中未提交」字段；推进点**只有**「重新加载」（`getTaskDetails`）与
    //              「提交成功」（`updateTaskDetails`，且仅限本次提交涉及的字段）。
    //              ⛔ 不得在 store 联动合并后推进 —— 自动刷新每 30s 一次（回拉窗口重放同一条），
    //              合并后一推进，下一轮就会把编辑误判成「已同步」并覆盖用户输入（`DEF-145` 实测丢字）。
    const persistedText = ref<{ name: string; description: string }>({ name: '', description: '' })

    /**
     * @state 非文本字段的「交互起点基准」（`DEF-153`）
     * @description 在控件**交互起点**（下拉/日期面板打开、标签编辑态进入、开关点击前）冻结该字段的
     *              **已持久化值** `O`；保存时只为本次载荷涉及的字段透传（判据仍是
     *              `F = keys(载荷) ∩ keys(基准)`，逐字段 `R≠O 且 L≠R`）。
     *              ⛔ 不得用 store 当前值当 `O` —— 自动刷新每 30s 推进它，判据会失效（`DEF-145` 教训）。
     *              成功提交后清除（下次交互重新冻结）；切换/重载任务时清空。
     */
    const editOrigins = ref<Record<string, unknown>>({})

    /**
     * 冻结某字段的编辑基准（`DEF-153`）
     * @description 幂等：同一字段已冻结 ⇒ 保留**首次**值（多轮交互 / 期间自动刷新都不覆盖）。
     */
    const beginEdit = (field: string): void => {
        const current = task.value as Record<string, unknown> | null
        if (!current) return
        if (Object.prototype.hasOwnProperty.call(editOrigins.value, field)) return
        editOrigins.value = { ...editOrigins.value, [field]: current[field] }
    }

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
        // 领域统计属性（服务端 owned，只读透传）
        checkItemCount: taskVO.checkItemCount,
        commentCount: taskVO.commentCount,
        subtaskCount: taskVO.subtaskCount,
        // 组内排序值（服务端 owned，只读透传）
        sortId: taskVO.sortId,
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
            editOrigins.value = {}
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
        persistedText.value = { name: _task.name, description: _task.description }
        // DEF-153：切换/重载任务 ⇒ 丢弃上一任务的交互起点基准
        editOrigins.value = {}
    }

    // @watch 订阅列表 store：任务在列表侧（看板/列表/表格）被更新时，同步刷新详情面板
    // 说明：详情面板数据源为 store（useTasksStore）单例，store 中当前任务变化即列表侧更新完成，
    //       重新组装即可联动 UI；latest 为 undefined（任务被移出视图）时不处理，避免误清空。
    // 注意：不能使用 deep: true —— Vue 的 watch job 触发条件 deep || hasChanged 在 deep 时恒真，
    //       回调每次赋值新 task.value 会反复触发源 effect 造成递归循环（Maximum recursive updates）。
    //       本 store 所有更新均为 map.set(id, 新对象) 整体替换，依赖引用变化即可正常触发。
    // 注意：字段级合并 —— name/description 由详情面板 textarea 的 v-model 直接写入本地 task.value
    //       （未 @change 提交前）；以「已持久化值」（`persistedText`）为基准识别"编辑中"字段并保留本地值，
    //       其余字段随 store 同步。⛔ 基准不得在合并后推进，否则下一轮自动刷新（回拉窗口每周期重放同一条）
    //       就会把未提交的编辑误判成「已同步」而覆盖用户输入（`DEF-145` 实测丢字）。
    watch(
        () => (task.value ? tasksStore.getTask(task.value.id) : undefined),
        (latest) => {
            if (!latest || !task.value) return
            const current = task.value
            const nameEdited = current.name !== persistedText.value.name
            const descriptionEdited = current.description !== persistedText.value.description
            const editedFields: Partial<TaskDetailsViewObject> = {}
            if (nameEdited) editedFields.name = current.name
            if (descriptionEdited) editedFields.description = current.description
            task.value = { ...assembleTaskViewObject(latest), ...editedFields }
            // 基准只跟随「未编辑」字段：编辑中的字段继续以（未变的）已持久化值为基准 ⇒ 多轮刷新都算「编辑中」
            persistedText.value = {
                name: nameEdited ? persistedText.value.name : latest.name,
                description: descriptionEdited
                    ? persistedText.value.description
                    : latest.description
            }
        }
    )

    /**
     * 更新任务详情
     * @description 成功时同步本地派生字段并返回 null；失败时 toast 并返回错误码（供调用方分支）
     * @param id 任务 ID
     * @param updateVO 任务更新视图对象
     * @returns 错误码（null = 成功）
     */
    const updateTaskDetails = async (
        id: TaskViewObject['id'],
        updateVO: UpdateTaskViewObject
    ): Promise<GoError> => {
        if (!id) return null
        // DEF-146：编辑基准 = 本次载荷涉及字段的「已持久化值」（用户编辑起点 `O`）
        //   ⇒ 保存侧判「编辑期间该字段被远端改过（R≠O）且我确实要覆盖（L≠R）」才记账。
        //   ⛔ 必须在成功分支推进 `persistedText` **之前**取值。
        const origin: TaskUpdateOrigin = {
            ...(updateVO.name === undefined ? {} : { name: persistedText.value.name }),
            ...(updateVO.description === undefined
                ? {}
                : { description: persistedText.value.description })
        }
        // DEF-153：非文本字段的交互起点基准 —— **只取本次载荷涉及**的字段（其余冻结值不使用）
        const payload = updateVO as Record<string, unknown>
        const consumedOrigins: string[] = []
        for (const [field, value] of Object.entries(editOrigins.value)) {
            if (payload[field] === undefined) continue
            if (Object.prototype.hasOwnProperty.call(origin, field)) continue
            ;(origin as Record<string, unknown>)[field] = value
            consumedOrigins.push(field)
        }
        const updateError = await taskUseCase.update(
            id,
            updateVO,
            Object.keys(origin).length === 0 ? undefined : origin
        )
        if (updateError !== null) {
            // 归档只读码的提示由守卫负责（本地化）；此处跳过，避免重复 + 原始错误码外泄（T191）
            if (!isArchivedReadOnlyError(updateError)) {
                NueMessage.error(translateTaskError(updateError))
            }
            return updateError
        }
        if (task.value === null) return null
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
        // 持久化基准推进（仅限本次提交涉及的字段）：提交后该字段重新跟随 store（保护只管「未保存」）
        persistedText.value = {
            name: updateVO.name !== undefined ? task.value.name : persistedText.value.name,
            description:
                updateVO.description !== undefined
                    ? task.value.description
                    : persistedText.value.description
        }
        // DEF-153：本次已消费的非文本基准失效（下次交互重新冻结）
        if (consumedOrigins.length > 0) {
            const nextOrigins = { ...editOrigins.value }
            for (const field of consumedOrigins) delete nextOrigins[field]
            editOrigins.value = nextOrigins
        }
        return null
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
            // T191：归档只读码静默（守卫已提示）
            if (!isArchivedReadOnlyError(giveUpError))
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
            // T191：归档只读码静默（守卫已提示）
            if (!isArchivedReadOnlyError(ungiveUpError)) {
                NueMessage.error(translateTaskError(ungiveUpError))
            }
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
        beginEdit,
        updateTaskDetails,
        deleteTask,
        restoreTask,
        giveUpTask,
        ungiveUpTask
    }
}

export default useTaskViewObject