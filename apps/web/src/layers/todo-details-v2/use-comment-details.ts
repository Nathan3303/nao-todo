import { computed, ref, watchEffect } from 'vue'
import { useCommentStore } from '@/stores'
import { useRoute } from 'vue-router'
import { NueMessage } from 'nue-ui'

export const useCommentDetails = () => {
    const route = useRoute()
    const commentStore = useCommentStore()

    const isCommenting = ref(false)
    const commentContent = ref('')

    const commentsCount = computed(() => commentStore.comments.length)

    const handleEnterNewLine = () => {
        // commentContent.value += '\n'
    }

    const handleLeaveComment = async (e: Event) => {
        e.preventDefault()
        if (!commentContent.value) {
            NueMessage.warn('评论内容不能为空')
            return
        }
        const createResult = await commentStore.doCreateComment({
            todoId: route.params.taskId as string,
            content: commentContent.value
        })
        if (createResult) {
            isCommenting.value = false
            commentContent.value = ''
            NueMessage.success('添加评论成功')
        } else {
            NueMessage.error('添加评论失败')
        }
    }

    watchEffect(() => {
        const todoId = route.params.taskId as string
        if (!todoId) return
        commentStore.getOptions = { todoId }
        setTimeout(async () => await commentStore.doGetComments())
    })

    return {
        isCommenting,
        commentContent,
        commentsCount,
        handleLeaveComment,
        handleEnterNewLine
    }
}
