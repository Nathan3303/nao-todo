<script lang="ts" setup>
import { Loading as LoadingComp } from '@nao-todo/components'
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
// import DetailsFooter from './details-footer.vue'
import useTaskDetails from './use-task-details'
import type { TaskDetailsProps, TaskDetailsEmits } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()
const emit = defineEmits<TaskDetailsEmits>()

const { loading, error, taskDetailsVO } = useTaskDetails(props, emit)
</script>

<template>
    <loading-comp v-if="loading" />
    <nue-empty
        v-else-if="error || !taskDetailsVO"
        :description="error"
        image-size="64px"
        image-src="/images/todo.webp"
        style="height: 100%"
    >
        <nue-div v-if="false" justify="center" style="margin-top: 1rem">
            <nue-button theme="primary,small" @click="emit('closeDetails')">
                返回任务列表
            </nue-button>
        </nue-div>
    </nue-empty>
    <nue-container v-else id="TasksTodoDetailsContainer" class="tasks-details-view">
        <details-header />
        <nue-main>
            <nue-content fill>
                <details-main />
            </nue-content>
        </nue-main>
        <!-- <nue-footer>
            <details-footer
                :shadow-todo="todo"
                @update-todo-project="todoDetailsStore.updateTodoProject"
                @delete-todo-permanently="todoDetailsStore.handleDeleteTodoPermenantly"
                @delete-todo="todoDetailsStore.handleDeleteTodo"
                @restore-todo="todoDetailsStore.handleRestoreTodo"
                @leave-todo-comment="handleStartLeaveComment"
                @duplicate-todo="todoDetailsStore.handleDuplicateTodo"
            />
        </nue-footer> -->
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
