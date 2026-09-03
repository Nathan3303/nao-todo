import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
    useTaskCommentsStoreBase,
    useTaskCommentIdsStoreBase,
    useTaskCheckItemsStoreBase,
    useTaskCheckItemIdsStoreBase,
    useTasksStoreBase
} from '../hooks'
import { useLoadingErrorStoreBase } from '@nao-todo/shared'
import type { TaskDetailsViewObject } from '../components/task-details/types'

export const useTaskDetailsStore = defineStore('TaskDetailsStore', () => {
    // 任务详情
    const taskDetails = ref<TaskDetailsViewObject>()

    // 设置任务详情
    const setTaskDetails = (newTaskDetails: TaskDetailsViewObject) => {
        taskDetails.value = newTaskDetails
    }

    // 检查事项列表以及相关操作
    const {
        checkItems,
        addCheckItem,
        setCheckItems,
        getCheckItem,
        updateCheckItem,
        deleteCheckItem,
        updateCheckItems
    } = useTaskCheckItemsStoreBase()

    // 评论列表以及相关操作
    const { addComment, setComments, getComment, updateComment, removeComment } =
        useTaskCommentsStoreBase()

    // 子任务列表以及相关操作
    const { tasks, setTasks, addTasks, addTask, getTask, updateTask, removeTask } =
        useTasksStoreBase()

    // 检查事项ID列表以及相关操作
    const {
        checkItemIds,
        checkItems: checkItemIdsCheckItems,
        setCheckItemIds,
        addCheckItemId,
        removeCheckItemId
    } = useTaskCheckItemIdsStoreBase(getCheckItem)

    // 评论ID列表以及相关操作
    const {
        commentIds,
        comments: commentIdsComments,
        setCommentIds,
        addCommentId,
        removeCommentId
    } = useTaskCommentIdsStoreBase(getComment)

    // 加载错误状态以及相关操作
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // 检查事项加载错误状态以及相关操作
    const {
        loading: checkItemsLoading,
        error: checkItemsError,
        setLoading: setCheckItemsLoading,
        setError: setCheckItemsError
    } = useLoadingErrorStoreBase()

    // 评论加载错误状态以及相关操作
    const {
        loading: commentsLoading,
        error: commentsError,
        setLoading: setCommentsLoading,
        setError: setCommentsError
    } = useLoadingErrorStoreBase()

    // 子任务加载错误状态以及相关操作
    const {
        loading: subTasksLoading,
        error: subTasksError,
        setLoading: setSubTasksLoading,
        setError: setSubTasksError
    } = useLoadingErrorStoreBase()

    // @returns
    return {
        // --- task details ---
        taskDetails,
        setTaskDetails,
        // --- loading error ---
        loading,
        error,
        setLoading,
        setError,
        // --- check item loading error ---
        checkItemsLoading,
        checkItemsError,
        setCheckItemsLoading,
        setCheckItemsError,
        // --- comment loading error ---
        commentsLoading,
        commentsError,
        setCommentsLoading,
        setCommentsError,
        // --- check items store base ---
        checkItems,
        addCheckItem,
        setCheckItems,
        getCheckItem,
        updateCheckItem,
        deleteCheckItem,
        updateCheckItems,
        // --- check item ids store base ---
        checkItemIds,
        checkItemIdsCheckItems,
        setCheckItemIds,
        addCheckItemId,
        removeCheckItemId,
        // --- comments store base ---
        addComment,
        setComments,
        getComment,
        updateComment,
        removeComment,
        // --- comment ids store base ---
        commentIds,
        commentIdsComments,
        setCommentIds,
        addCommentId,
        removeCommentId,
        // --- sub tasks store base ---
        tasks,
        setTasks,
        addTasks,
        addTask,
        getTask,
        updateTask,
        removeTask,
        // --- sub tasks loading error ---
        subTasksLoading,
        subTasksError,
        setSubTasksLoading,
        setSubTasksError
    }
})