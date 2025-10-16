<script lang="ts" setup>
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Loading as LoadingComp } from '@nao-todo/components'
import DetailsHeader from './details-header.vue'
import DetailsMain from './details-main.vue'
import DetailsFooter from './details-footer.vue'
import { NueTextarea } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { useTodoDetailsStore } from '@/stores/tasks'
import type { DetailsEmits } from './types'

defineOptions({ name: 'TasksTodoDetails' })
const emit = defineEmits<DetailsEmits>()

const router = useRouter()
const route = useRoute()
const todoDetailsStore = useTodoDetailsStore()

const leaveCommentInputRef = ref<InstanceType<typeof NueTextarea>>()

const { loading, error, todo, eventsProgress, updating, isCommenting, commentsCount, statusText } =
    storeToRefs(todoDetailsStore)

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
        :description="error"
        image-size="64px"
        image-src="/images/todo.webp"
        style="height: 100%"
    >
        <nue-div justify="center" style="margin-top: 1rem">
            <nue-button theme="primary,small" @click="handleClose">返回任务列表</nue-button>
        </nue-div>
    </nue-empty>
    <nue-container v-else id="TasksTodoDetailsContainer" class="tasks-details-view">
        <nue-header>
            <details-header
                :shadow-todo="todo"
                :updating="updating"
                :disable-close="loading || updating"
                @update-todo-end-at="todoDetailsStore.updateTodoEndAt"
                @finish-todo="todoDetailsStore.handleCheckTodo"
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
                    :leaveCommentHandler="todoDetailsStore.handleLeaveComment"
                    :status-text="statusText"
                    @update="todoDetailsStore.updateTodo"
                    @update-todo-state="todoDetailsStore.updateTodoState"
                    @update-todo-priority="todoDetailsStore.updateTodoPriority"
                    @update-todo-tags="todoDetailsStore.updateTodoTags"
                    @cancel-leave-comment="() => (isCommenting = false)"
                />
            </nue-content>
        </nue-main>
        <nue-footer>
            <details-footer
                :shadow-todo="todo"
                @update-todo-project="todoDetailsStore.updateTodoProject"
                @delete-todo-permanently="todoDetailsStore.handleDeleteTodoPermenantly"
                @delete-todo="todoDetailsStore.handleDeleteTodo"
                @restore-todo="todoDetailsStore.handleRestoreTodo"
                @leave-todo-comment="handleStartLeaveComment"
                @duplicate-todo="todoDetailsStore.handleDuplicateTodo"
            />
        </nue-footer>
    </nue-container>
    <!-- @give-up-todo="handleGiveUpTodo" -->
    <!-- @cancel-give-up-todo="handleCancelGiveUpTodo" -->
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
