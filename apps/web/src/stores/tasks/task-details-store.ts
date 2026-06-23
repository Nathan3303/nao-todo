import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
    useEventsStoreBase,
    useCommentsStoreBase,
    useLoadingErrorStoreBase,
    useDualLoadingErrorStoreBase,
    useEventIdsStoreBase,
    useCommentIdsStoreBase
} from '../base'
import type { TaskDetailsViewObject } from '@/layouts/app/task-details/types'

const useTaskDetailsStore = defineStore('TaskDetailsStore', () => {
    // @state 任务详情
    const taskDetails = ref<TaskDetailsViewObject>()

    // @state 设置任务详情
    const setTaskDetails = (newTaskDetails: TaskDetailsViewObject) => {
        taskDetails.value = newTaskDetails
    }

    // @storebase Loading error store base (保留原有用于向后兼容)
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // @storebase Dual loading error store base
    const {
        eventsLoading,
        eventsError,
        commentsLoading,
        commentsError,
        setEventsLoading,
        setEventsError,
        setCommentsLoading,
        setCommentsError
    } = useDualLoadingErrorStoreBase()

    // @storebase Events store base
    const { events, addEvent, setEvents, getEvent, updateEvent, deleteEvent, updateEvents } =
        useEventsStoreBase()

    // @storebase Event Ids store base
    const {
        eventIds,
        events: eventIdsEvents,
        setEventIds,
        addEventId,
        removeEventId
    } = useEventIdsStoreBase(getEvent)

    // @storebase Comment store base
    const { addComment, setComments, getComment, updateComment, removeComment } =
        useCommentsStoreBase()

    // @storebase Comment Ids store base
    const {
        commentIds,
        comments: commentIdsComments,
        setCommentIds,
        addCommentId,
        removeCommentId
    } = useCommentIdsStoreBase(getComment)

    // @return
    return {
        taskDetails,
        setTaskDetails,
        loading,
        error,
        setLoading,
        setError,
        eventsLoading,
        eventsError,
        commentsLoading,
        commentsError,
        setEventsLoading,
        setEventsError,
        setCommentsLoading,
        setCommentsError,
        events,
        addEvent,
        setEvents,
        getEvent,
        addComment,
        setComments,
        getComment,
        eventIds,
        eventIdsEvents,
        setEventIds,
        addEventId,
        removeEventId,
        commentIds,
        commentIdsComments,
        setCommentIds,
        addCommentId,
        removeCommentId,
        updateComment,
        removeComment,
        updateEvent,
        updateEvents,
        deleteEvent
    }
})

export default useTaskDetailsStore

