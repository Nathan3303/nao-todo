<script lang="ts" setup>
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTasksDataStore } from '@/stores/tasks'
import { useTodoDetails } from './use-details'
import { useCommentDetails } from './use-comment-details'
import { Loading as LoadingComp } from '@nao-todo/components'
import DetailsHeader from './details-header.vue'
import DetailsMain from './details-main.vue'
import DetailsFooter from './details-footer.vue'
import { NueTextarea } from 'nue-ui'
import type { DetailsEmits } from './types'

defineOptions({ name: 'TasksTodoDetails' })
const emit = defineEmits<DetailsEmits>()

const tasksDataStore = useTasksDataStore()
const router = useRouter()
const route = useRoute()

const leaveCommentInputRef = ref<InstanceType<typeof NueTextarea>>()

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
const { isCommenting, commentsCount, handleLeaveComment } = useCommentDetails(todo.value?.id)

const handleClose = () => {
    router.push({ name: route.name, params: { todoId: void 0 } }).then(() => {
        emit('close')
    })
}

const handleStartLeaveComment = () => {
    isCommenting.value = !isCommenting.value
    if (isCommenting.value) nextTick(() => leaveCommentInputRef.value?.innerInputRef.focus())
}
</script>

<template>
    <loading-comp v-if="loading" />
    <nue-empty
        v-else-if="error || !todo"
        description="选择左侧的任务以查看详细"
        image-size="64px"
        image-src="/images/todo.webp"
        style="height: 100%"
    />
    <nue-container v-else id="TasksTodoDetailsContainer" class="tasks-details-view">
        <nue-header>
            <details-header
                :shadow-todo="todo"
                :updating="updating"
                :disable-close="loading || updating"
                @update-todo-end-at="updateTodoEndAt"
                @finish-todo="handleCheckTodo"
                @close="handleClose"
            />
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
                    @cancel-leave-comment="() => (isCommenting = false)"
                />
            </nue-content>
        </nue-main>
        <nue-footer>
            <details-footer
                :shadow-todo="todo"
                @update-todo-project="updateTodoProject"
                @delete-todo-permanently="(id) => tasksDataStore.deleteProjectPermanently(id)"
                @delete-todo="(id) => tasksDataStore.deleteTodo(id)"
                @restore-todo="(id) => tasksDataStore.restoreTodo(id)"
                @leave-todo-comment="handleStartLeaveComment"
            />
            <!-- @duplicate-todo="handleDuplicateTodo" -->
            <!-- @give-up-todo="handleGiveUpTodo" -->
            <!-- @cancel-give-up-todo="handleCancelGiveUpTodo" -->
        </nue-footer>
    </nue-container>
</template>

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
