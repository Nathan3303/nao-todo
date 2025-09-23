<template>
    <details-loading v-if="loading" />
    <details-empty v-else-if="error || !todo" />
    <nue-container v-else id="TasksTodoDetailsContainer" class="tasks-details-view">
        <nue-header>
            <details-header
                :shadow-todo="todo"
                :updating="updating"
                :disable-close="loading || updating"
                @update-todo-end-at="updateTodoEndAt"
                @finish-todo="handleCheckTodo"
            />
            <!--            -->
            <!--            @close="handleClose"-->
        </nue-header>
        <nue-main>
            <nue-content fill>
                <details-main
                    :shadow-todo="todo"
                    :events-progress="eventsProgress"
                    :comments-count="commentsCount"
                    :is-commenting="isCommenting"
                    :leaveCommentHandler="handleLeaveComment"
                    @update="updateTodo"
                    @update-todo-state="updateTodoState"
                    @update-todo-priority="updateTodoPriority"
                    @update-todo-tags="updateTodoTags"
                />
                <!-- @cancel-leave-comment="() => (isCommenting = false)" -->
            </nue-content>
        </nue-main>
        <nue-footer>
            <details-footer :shadow-todo="todo" @update-todo-project="updateTodoProject" />
            <!-- 
                @leave-todo-comment="handleStartLeaveComment"
                @duplicate-todo="handleDuplicateTodo"
                @delete-todo-permanently="handleDeleteTodoPermanently"
                @delete-todo="handleDeleteTodo"
                @restore-todo="handleRestoreTodo"
                @give-up-todo="handleGiveUpTodo"
                @cancel-give-up-todo="handleCancelGiveUpTodo" -->
        </nue-footer>
    </nue-container>
</template>

<script lang="ts" setup>
import { DetailsEmpty, DetailsHeader, DetailsLoading, DetailsMain, DetailsFooter } from '.'
import { useTodoDetails } from './use-details'
import { useCommentDetails } from './use-comment-details'

defineOptions({ name: 'TasksTodoDetails' })

const {
    loading,
    error,
    todo,
    eventsProgress,
    updating,
    updateTodoEndAt,
    updateTodo,
    updateTodoPriority,
    updateTodoState,
    handleCheckTodo,
    updateTodoProject,
    updateTodoTags
} = useTodoDetails()
const { isCommenting, commentsCount, handleLeaveComment } = useCommentDetails()
</script>

<style scoped>
.nue-container#TasksTodoDetailsContainer {
    gap: 0;

    > .nue-header,
    > .nue-main {
        padding: 0;
        border: none;
        height: auto;
    }

    > .nue-footer {
        padding: 1rem;
        height: auto;
        border-top: 1px solid var(--nue-border-color);
    }
}
</style>
