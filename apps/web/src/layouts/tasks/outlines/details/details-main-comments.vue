<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useTodoDetailsStore } from '@/stores/tasks'
import { CommentRow } from '@nao-todo/components'

const todoDetailsStore = useTodoDetailsStore()

const { comments } = storeToRefs(todoDetailsStore)
</script>

<template>
    <nue-div
        v-if="comments.length"
        style="border-top: 1px solid var(--nue-divider-color); padding: 8px"
    >
        <nue-div vertical gap="0">
            <nue-div style="padding: 8px">
                <nue-text size="14px" :weight="500">评论</nue-text>
                <nue-text size="14px" color="gray">{{ comments.length }}</nue-text>
            </nue-div>
            <nue-div vertical gap="0.75rem" style="padding: 8px 0">
                <comment-row
                    v-for="comment in comments"
                    :key="comment.id"
                    :comment="comment"
                    :updater="todoDetailsStore.handleEditComment"
                    @delete="todoDetailsStore.handleDeleteComment"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>
