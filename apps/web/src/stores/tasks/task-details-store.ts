import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useEventsStoreBase, useCommentsStoreBase, useLoadingErrorStoreBase } from '../base'
import type { TaskDetailsViewObject } from '@/layouts/tasks/task-details/types'

const useTaskDetailsStore = defineStore('TaskDetailsStore', () => {
    // @state 任务详情
    const taskDetails = ref<TaskDetailsViewObject>()

    // @state 设置任务详情
    const setTaskDetails = (newTaskDetails: TaskDetailsViewObject) => {
        taskDetails.value = newTaskDetails
    }

    // @storebase Loading error store base
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // @storebase Events store base
    const { addEvent, setEvents, getEvent } = useEventsStoreBase()

    // @storebase Comment store base
    const { addComment, setComments, getComment } = useCommentsStoreBase()

    // @return
    return {
        taskDetails,
        setTaskDetails,
        loading,
        error,
        setLoading,
        setError,
        addEvent,
        setEvents,
        getEvent,
        addComment,
        setComments,
        getComment
    }
})

export default useTaskDetailsStore
