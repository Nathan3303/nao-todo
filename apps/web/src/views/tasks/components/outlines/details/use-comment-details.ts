import { computed, ref } from 'vue'
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

    const handleLeaveComment = async (content: string) => {
        const createResult = await commentStore.doCreateComment({
            todoId: route.params.taskId as string,
            content: content
        })
        if (createResult) {
            NueMessage.success('添加评论成功')
        } else {
            NueMessage.error('添加评论失败')
        }
        return createResult
    }

    return {
        isCommenting,
        commentContent,
        commentsCount,
        handleLeaveComment,
        handleEnterNewLine
    }
}
