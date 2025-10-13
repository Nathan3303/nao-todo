import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { NueMessage } from 'nue-ui'
import { useRoute } from 'vue-router'
import type { Todo } from '@nao-todo/types'

export const useCommentDetails = (todoId?: Todo['id']) => {
    const tasksDataStore = useTasksDataStore()
    const route = useRoute()

    const { comments } = storeToRefs(tasksDataStore)
    const isCommenting = ref(false)
    const commentContent = ref('')

    const commentsCount = computed(() => comments.value.length)

    const handleEnterNewLine = () => {
        commentContent.value += '\n'
    }

    const handleLeaveComment = async (content: string) => {
        const _todoId = todoId || route.params.todoId as Todo['id']
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

    return {
        isCommenting,
        commentContent,
        commentsCount,
        handleLeaveComment,
        handleEnterNewLine
    }
}
