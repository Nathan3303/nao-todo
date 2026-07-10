import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
    useTaskCommentsStoreBase,
    useLoadingErrorStoreBase,
    useTaskCommentIdsStoreBase,
    useTaskCheckItemsStoreBase,
    useTaskCheckItemIdsStoreBase,
    useTasksStoreBase
} from '../base'
import type { TaskDetailsViewObject } from '@/layouts/app/task-details/types'

const useTaskDetailsStore = defineStore('TaskDetailsStore', () => {
    const taskDetails = ref<TaskDetailsViewObject>()

    const setTaskDetails = (newTaskDetails: TaskDetailsViewObject) => {
        taskDetails.value = newTaskDetails
    }

    const {
        checkItems,
        addCheckItem,
        setCheckItems,
        getCheckItem,
        updateCheckItem,
        deleteCheckItem,
        updateCheckItems
    } = useTaskCheckItemsStoreBase()

    const { addComment, setComments, getComment, updateComment, removeComment } =
        useTaskCommentsStoreBase()

    const {
        checkItemIds,
        checkItems: checkItemIdsCheckItems,
        setCheckItemIds,
        addCheckItemId,
        removeCheckItemId
    } = useTaskCheckItemIdsStoreBase(getCheckItem)

    const {
        commentIds,
        comments: commentIdsComments,
        setCommentIds,
        addCommentId,
        removeCommentId
    } = useTaskCommentIdsStoreBase(getComment)

    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    const {
        loading: checkItemsLoading,
        error: checkItemsError,
        setLoading: setCheckItemsLoading,
        setError: setCheckItemsError
    } = useLoadingErrorStoreBase()

    const {
        loading: commentsLoading,
        error: commentsError,
        setLoading: setCommentsLoading,
        setError: setCommentsError
    } = useLoadingErrorStoreBase()

    const {
        tasks: subTasks,
        setTasks: setSubTasks,
        addTasks: addSubTasks,
        addTask: addSubTask,
        getTask: getSubTask,
        updateTask: updateSubTask,
        removeTask: removeSubTask
    } = useTasksStoreBase()

    const {
        loading: subTasksLoading,
        error: subTasksError,
        setLoading: setSubTasksLoading,
        setError: setSubTasksError
    } = useLoadingErrorStoreBase()

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
        subTasks,
        setSubTasks,
        addSubTasks,
        addSubTask,
        getSubTask,
        updateSubTask,
        removeSubTask,
        // --- sub tasks loading error ---
        subTasksLoading,
        subTasksError,
        setSubTasksLoading,
        setSubTasksError
    }
})

export default useTaskDetailsStore

