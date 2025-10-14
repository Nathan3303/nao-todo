import { computed, ref, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useTodoStore } from '@/stores/global'
import { useTasksDataStore } from '@/stores/tasks'
import { unwrapError, unwrapErrors } from '@nao-todo/utils'
import { useUpdateQueue, type UpdateQueueItem } from '@/hooks'
import { NueMessage } from 'nue-ui'
import type { Todo, UpdateTodoOptions, Comment, Event } from '@nao-todo/types'
import type { InputButtonSubmitPayload, TodoEventRowUpdatePayload } from '@nao-todo/components'

const useTodoDetailsStore = defineStore('TodoDetailsStore', () => {
    // @stores 全局 stores
    const tasksDataStore = useTasksDataStore()
    const route = useRoute()
    const todoStore = useTodoStore()

    // @states 前置状态
    const { todos, events, comments } = storeToRefs(tasksDataStore)

    // @state 加载以及错误状态
    const loading = ref(false)
    const error = ref('')

    // @state 待办任务详情
    const todo = ref<Todo>()

    // @method 从后端请求待办任务详细 - 通常用于携带 todoId 进入页面时
    const getTodoDetailsFromBackend = async (todoId: string): Promise<Todo | undefined> => {
        // 获取待办任务
        const [todo, err] = await todoStore.toGetTodo({ id: todoId })
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return void 0
        }
        // 处理成功结果
        return todo
    }

    // @watch 监听路由中的 todoId，当路由变化后获取对应数据
    watch(
        () => route.params.todoId as string,
        async (newTodoId) => {
            // 判断并获取 todoId
            if (!newTodoId) return (todo.value = void 0)
            // 重置加载状态
            loading.value = true
            // 查找待办任务
            todo.value = todos.value.find((todo) => todo.id === newTodoId)
            // 待办任务不存在，尝试从后端获取
            if (!todo.value) {
                todo.value = await getTodoDetailsFromBackend(newTodoId)
            }
            // 处理待办任务不存在结果
            if (!todo.value) {
                // 用户提示
                NueMessage.error('待办任务详细获取失败')
                // 恢复加载状态
                loading.value = false
                return
            }
            // 获取检查事项
            const getEventsErr = await tasksDataStore.getEvents({ todoId: newTodoId })
            // 获取待办任务评论
            const getCommentsErr = await tasksDataStore.getComments({ todoId: newTodoId })
            // 处理错误
            if (getEventsErr || getCommentsErr) {
                console.error(unwrapErrors(getEventsErr, getCommentsErr))
            }
            // 恢复加载状态
            loading.value = false
        },
        { immediate: true }
    )

    // @computed 检查事项进度计算属性
    const eventsProgress = computed(() => {
        const _e = events.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '待办目前无检查事项'
        return { percentage, text }
    })

    // @state 更新队列
    const updateQueue = useUpdateQueue(async (item: UpdateQueueItem) => {
        // 更新待办任务
        const err = await todoStore.updateTodo(item.todoId, item.updateOptions)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return
        }
        // 修改待办任务更新时间
        if (todo.value) {
            todo.value.updatedAt = new Date().toISOString()
        }
    })

    // @method 更新待办任务截止时间
    const updateTodoEndAt = async (endAt: Todo['endAt']) => {
        if (!todo.value) return
        todo.value.endAt = endAt
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { endAt } })
    }

    // @method 更新待办任务 (名称、描述、收藏等直接更改原值的更新)
    const updateTodo = async (key: keyof UpdateTodoOptions) => {
        if (!todo.value) return
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { [key]: todo.value[key] } })
    }

    // @method 更新待办任务优先级
    const updateTodoPriority = (value: Todo['priority']) => {
        if (!todo.value) return
        todo.value.priority = value
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { priority: value } })
    }

    // @methods 更新待办任务状态
    const updateTodoState = (value: Todo['state']) => {
        if (!todo.value) return
        todo.value.state = value
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { state: value } })
    }
    const handleCheckTodo = async () => {
        if (!todo.value) return
        const newState = (todo.value.state === 'done' ? 'todo' : 'done') as Todo['state']
        updateTodoState(newState)
    }

    // @method 更新待办任务所属清单
    const updateTodoProject = async (projectId: string) => {
        if (!todo.value) return
        todo.value.projectId = projectId
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { projectId } })
    }

    // @method 更新待办任务所属标签
    const updateTodoTags = async (tags: Todo['tags']) => {
        if (!todo.value) return
        todo.value.tags = tags
        updateQueue.insertItem({ todoId: todo.value.id, updateOptions: { tags } })
    }

    // @method 永久删除待办任务
    const handleDeleteTodoPermenantly = async (todoId: Todo['id']) => {
        if (!todo.value) return
        const ok = await tasksDataStore.deleteTodoPermanently(todoId)
        if (ok) {
            todo.value = void 0
        }
    }

    // @states 检查事项功能相关状态

    // @method 处理创建待办任务检查事项
    const handleCreateEvent = async (payload: InputButtonSubmitPayload) => {
        const _todoId = todo.value?.id
        if (!_todoId) {
            NueMessage.error('添加检查事项失败')
            return false
        }
        return await tasksDataStore.createEvent({
            todoId: _todoId,
            name: payload.value as string
        })
    }

    // @method 处理更新待办任务检查事项
    const handleUpdateEvent = async (payload: TodoEventRowUpdatePayload) => {
        return await tasksDataStore.updateEvent(payload.id, {
            name: payload.name,
            isDone: payload.isDone
        })
    }

    // @method 处理删除待办任务检查事项
    const handleDeleteEvent = async (eventId: Event['id']) => {
        return await tasksDataStore.deleteEvent(eventId)
    }

    // @states 评论功能相关状态
    const isCommenting = ref(false)
    const commentContent = ref('')
    const commentsCount = computed(() => comments.value.length)

    // @method 处理创建待办任务评论
    const handleLeaveComment = async (content: string) => {
        const _todoId = todo.value?.id
        if (!_todoId) {
            NueMessage.error('添加评论失败')
            return false
        }
        const err = await tasksDataStore.createComment({
            todoId: _todoId,
            content: content
        })
        if (err) {
            NueMessage.error('添加评论失败')
            return false
        }
        NueMessage.success('添加评论成功')
        isCommenting.value = false
        return true
    }

    // @method 处理更新待办任务评论
    const handleEditComment = async (id: Comment['id'], newContent: Comment['content']) => {
        const err = await tasksDataStore.updateComment(id, { content: newContent })
        return !err
    }

    // @method 处理删除待办任务评论
    const handleDeleteComment = async (id: Comment['id']) => {
        const err = await tasksDataStore.deleteComment(id)
        if (err) {
            NueMessage.error('评论删除失败')
            return
        }
        NueMessage.success('评论删除成功')
    }

    // @returns
    return {
        todo,
        events,
        comments,
        loading,
        error,
        eventsProgress,
        updating: updateQueue.running,
        updateTodoEndAt,
        updateTodo,
        updateTodoPriority,
        updateTodoState,
        handleCheckTodo,
        updateTodoProject,
        updateTodoTags,
        handleDeleteTodoPermenantly,
        handleDeleteTodo: tasksDataStore.deleteTodo,
        handleRestoreTodo: tasksDataStore.restoreTodo,
        handleCreateEvent,
        handleUpdateEvent,
        handleDeleteEvent,
        isCommenting,
        commentsCount,
        commentContent,
        handleLeaveComment,
        handleEnterNewLine: () => (commentContent.value += '\n'),
        handleEditComment,
        handleDeleteComment
    }
})

export default useTodoDetailsStore
