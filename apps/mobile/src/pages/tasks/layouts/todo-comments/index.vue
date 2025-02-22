<script lang="ts" setup>
import { watch } from 'vue'
import { useCommentStore } from '@/pages/tasks/stores/comment'
import { useTasksViewStore } from '@/pages/tasks/stores/view'
import { storeToRefs } from 'pinia'
import CommentRow from './comment-row.vue'

defineOptions({ name: 'TodoComments' })

const commentStore = useCommentStore()
const tasksViewStore = useTasksViewStore()

const { todoDetailsId } = storeToRefs(tasksViewStore)
const { comments } = storeToRefs(commentStore)

const getComments = async () => {
    if (!todoDetailsId.value) return
    commentStore.getOptions.todoId = todoDetailsId.value
    await commentStore.getComments()
}

watch(
    () => todoDetailsId.value,
    () => getComments(),
    { immediate: true }
)
</script>

<template>
    <view class="todo-comments">
        <view class="todo-comments__header">
            <text>评论</text>
            <text class="todo-comment__header__count">{{ comments.length }}</text>
        </view>
        <view class="todo-comments__main">
            <comment-row v-for="comment in comments" :key="comment.id" :comment="comment" />
        </view>
    </view>
</template>

<style scoped>
.todo-comments {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.todo-comments__header {
    display: flex;
    height: 32px;
    align-items: center;
    flex-wrap: nowrap;
    gap: 1rem;
}

.todo-comment__header__count {
    font-size: var(--text-xs);
    color: var(--primary-color-700);
}

.todo-comments__main {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
}
</style>
