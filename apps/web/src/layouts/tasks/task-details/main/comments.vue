<script lang="ts" setup>
import { CommentRow } from '@nao-todo/components'
import type { TaskDetailsContext } from '../types'
import { TASK_DETAILS_CONTEXT_KEY } from '../constants'
import { inject } from 'vue'
import type { CommentViewObject } from '@nao-todo/types'

const { comments, commentHandler } = inject<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY)!

const commentUpdater = async (id: CommentViewObject['id'], content: string) =>
    commentHandler.updateComment(id, { content })

const deleteComment = async (id: CommentViewObject['id']) => commentHandler.deleteComment(id)
</script>

<template>
    <nue-container v-if="comments && comments.length" id="TodoDetailsCommentsContainer">
        <nue-header>
            <nue-text size="14px" :weight="500">评论</nue-text>
            <nue-text size="14px" color="gray">{{ comments.length }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content>
                <comment-row
                    v-for="comment in comments"
                    :key="comment.id"
                    :comment="comment"
                    :updater="commentUpdater"
                    :deleter="deleteComment"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#TodoDetailsCommentsContainer {
    border-top: 1px solid var(--nue-divider-color);
    padding: 0.5rem;
    gap: 0.5rem;
    height: auto;

    > .nue-header {
        height: auto;
        padding: 0.5rem;
        border: none;
    }

    > .nue-main {
        height: auto;
        border: none;
        margin-bottom: 1rem;

        > .nue-content {
            display: flex;
            flex-direction: column;
            flex-wrap: nowrap;
            gap: 0.75rem;
            overflow: hidden;
        }
    }
}
</style>

