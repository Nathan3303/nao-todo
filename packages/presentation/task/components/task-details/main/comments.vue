<script lang="ts" setup>
import { CommentRow, Loading, t } from '@nao-todo/shared'
import { inject } from 'vue'
import type { TaskCommentViewObject } from '@nao-todo/application'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'

const { comments, commentHandler, commentsLoading, commentsError, retryComments } =
    inject(TASK_DETAILS_CONTEXT_KEY)!

const commentUpdater = async (id: TaskCommentViewObject['id'], content: string) =>
    commentHandler.update(id, { content })

const deleteComment = async (id: TaskCommentViewObject['id']) => commentHandler.delete(id)
</script>

<template>
    <nue-container
        v-if="commentsLoading || commentsError || (comments && comments.length > 0)"
        id="TodoDetailsCommentsContainer"
    >
        <nue-header>
            <nue-text size="14px" :weight="500">{{ t('task.details.comments') }}</nue-text>
            <nue-text v-if="comments && comments.length" size="14px" color="gray">
                {{ comments.length }}
            </nue-text>
        </nue-header>
        <nue-main>
            <nue-content>
                <loading v-if="commentsLoading" :placeholder="t('task.details.commentsLoading')" />
                <nue-empty v-else-if="commentsError" :description="commentsError" image-size="64px">
                    <nue-button theme="primary,small" @click="retryComments">
                        {{ t('common.retry') }}
                    </nue-button>
                </nue-empty>
                <template v-else>
                    <comment-row
                        v-for="comment in comments"
                        :key="comment.id"
                        :comment="comment"
                        :updater="commentUpdater"
                        :deleter="deleteComment"
                    />
                </template>
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
    overflow: unset;

    > .nue-header {
        height: auto;
        padding: 0.5rem;
        border: none;
        color: var(--nue-primary-color-900);
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

