<template>
    <details-loading v-if="isGetting" />
    <nue-container
        v-else-if="shadowTodo"
        :key="shadowTodo?.id"
        class="tasks-details-view"
        theme="vertical,inner"
    >
        <details-header
            :shadow-todo="shadowTodo"
            :disable-close="isGetting || loadingState"
            @finish-todo="handleCheckTodo"
            @change-todo-end-at="handleChangeEndAt"
            @close="handleClose"
        />
        <details-main
            :shadow-todo="shadowTodo"
            :events-progress="eventsProgress"
            :comments-count="commentsCount"
            :is-commenting="isCommenting"
            :leaveCommentHandler="handleLeaveComment"
            @update-todo-state="handleChangeState"
            @update-todo-priority="handleChangePriority"
            @update="updateTodo"
            @update-todo-tags="handleUpdateTags"
            @cancel-leave-comment="() => (isCommenting = false)"
        />
        <details-footer
            :shadow-todo="shadowTodo"
            @update-todo-project="handleMoveToProject"
            @leave-todo-comment="handleStartLeaveComment"
            @duplicate-todo="handleDuplicateTodo"
            @delete-todo-permanently="handleDeleteTodoPermanently"
            @delete-todo="handleDeleteTodo"
            @restore-todo="handleRestoreTodo"
        />
    </nue-container>
    <details-empty v-else />
</template>

<script lang="ts" setup>
import { DetailsEmpty, DetailsFooter, DetailsHeader, DetailsLoading, DetailsMain } from '.'
import { nextTick, ref } from 'vue'
import { useTodoDetails } from './use-details'
import { useCommentDetails } from './use-comment-details'
import { NueTextarea } from 'nue-ui'

defineOptions({ name: 'TodoDetailsV2' })

const leaveCommentInputRef = ref<InstanceType<typeof NueTextarea>>()

const {
    shadowTodo,
    loadingState,
    isGetting,
    eventsProgress,
    updateTodo,
    handleChangeEndAt,
    handleChangeState,
    handleChangePriority,
    handleMoveToProject,
    handleClose,
    handleCheckTodo,
    handleDeleteTodo,
    handleDeleteTodoPermanently,
    handleRestoreTodo,
    handleUpdateTags,
    handleDuplicateTodo
} = useTodoDetails()
const { isCommenting, commentsCount, handleLeaveComment } = useCommentDetails()

const handleStartLeaveComment = () => {
    isCommenting.value = !isCommenting.value
    if (isCommenting.value) nextTick(() => leaveCommentInputRef.value?.innerInputRef.focus())
}
</script>
