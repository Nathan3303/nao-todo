<script lang="ts" setup>
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
import DetailsFooter from './footer/index.vue'
import useTaskDetails from './task-details'
import { LoadingError } from '@nao-todo/components'
import type { TaskDetailsProps, TaskDetailsEmits } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()
const emit = defineEmits<TaskDetailsEmits>()

const { error, task, closeDetails } = useTaskDetails(props, emit)
</script>

<template>
    <loading-error
        :error="!!error || !task"
        error-image-src="/images/todo.webp"
        error-image-size="4rem"
    >
        <!-- 错误状态 -->
        <template #error>
            <nue-div v-if="false" justify="center" style="margin-top: 1rem">
                <nue-button theme="primary,small" @click="closeDetails">返回任务列表</nue-button>
            </nue-div>
        </template>
        <!-- 正常状态 -->
        <nue-container id="TasksTodoDetailsContainer" class="tasks-details-view">
            <details-header />
            <nue-main>
                <nue-content fill>
                    <details-main />
                </nue-content>
            </nue-main>
            <details-footer />
        </nue-container>
    </loading-error>
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

