<template>
    <nue-container>
        <nue-header height="auto">
            <nue-div style="padding: 8px">
                <nue-text size="14px" weight="500">评论</nue-text>
                <nue-text size="14px" color="gray">{{ comments.length }}</nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-div align="stretch" gap="8px" vertical>
                <comment-row
                    v-for="comment in comments"
                    :key="comment.id"
                    :comment="comment"
                    :updater="handleEditComment"
                    @delete="handleDeleteComment"
                />
            </nue-div>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { useCommentStore } from '@/stores'
import { CommentRow } from '@nao-todo/components'
import { storeToRefs } from 'pinia'
import { NueMessage } from 'nue-ui'
import type { Comment } from '@nao-todo/types'

defineOptions({ name: 'TodoCommentsDetails' })

const commentStore = useCommentStore()

const { comments } = storeToRefs(commentStore)

const handleEditComment = async (id: Comment['id'], newContent: Comment['content']) => {
    return await commentStore.doUpdateComment(id, { content: newContent })
}

const handleDeleteComment = async (id: Comment['id']) => {
    const deleteResult = await commentStore.doDeleteComment(id)
    if (deleteResult) {
        NueMessage.success('评论删除成功')
    } else {
        NueMessage.error('评论删除失败')
    }
}
</script>

<style scoped>
.nue-main {
    border: none !important;
    padding-bottom: 8px;
}

.nue-main:deep(.nue-main__content) {
    padding: 0;
}
</style>
