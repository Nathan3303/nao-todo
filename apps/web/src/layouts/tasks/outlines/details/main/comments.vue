<script lang="ts" setup>
// import { storeToRefs } from 'pinia'
// import { useTodoDetailsStore } from '@/stores/tasks'
// import { CommentRow } from '@nao-todo/components'

// const todoDetailsStore = useTodoDetailsStore()

// const { comments } = storeToRefs(todoDetailsStore)
</script>

<template>
    <!-- <nue-container v-if="comments.length" id="TodoDetailsCommentsContainer">
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
                    :updater="todoDetailsStore.handleEditComment"
                    @delete="todoDetailsStore.handleDeleteComment"
                />
            </nue-content>
        </nue-main>
    </nue-container> -->
    Comments
</template>

<style scoped>
/* #TodoDetailsCommentsContainer {
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
} */
</style>
