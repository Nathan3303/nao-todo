<script lang="ts" setup>
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
import DetailsFooter from './footer/index.vue'
import useTaskDetails from './task-details'
import type { TaskDetailsProps, TaskDetailsEmits } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()
const emit = defineEmits<TaskDetailsEmits>()

const { error, task, handleDeleteTask, handleRestoreTask } = useTaskDetails(props, emit)
</script>

<template>
    <nue-empty
        v-if="error || !task"
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
        <details-footer @deleteTask="handleDeleteTask" @restoreTask="handleRestoreTask" />
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

