<script lang="ts" setup>
import { Loading } from '@nao-todo/components'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import { inject } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'

const { subTasks, subTasksLoading, subTasksError, retrySubTasks, switchTaskDetails } =
    inject(TASK_DETAILS_CONTEXT_KEY)!
</script>

<template>
    <nue-container
        v-if="subTasksLoading || subTasksError || (subTasks && subTasks.length > 0)"
        id="TodoDetailsSubTasksContainer"
    >
        <nue-header>
            <nue-text size="14px" :weight="500">{{ t('task.details.subTasks') }}</nue-text>
            <nue-text v-if="subTasks && subTasks.length" size="14px" color="gray">
                {{ subTasks.length }}
            </nue-text>
        </nue-header>
        <nue-main>
            <nue-content>
                <loading v-if="subTasksLoading" :placeholder="t('task.details.subTasksLoading')" />
                <nue-empty v-else-if="subTasksError" :description="subTasksError" image-size="64px">
                    <nue-button theme="primary,small" @click="retrySubTasks">
                        {{ t('common.retry') }}
                    </nue-button>
                </nue-empty>
                <template v-else>
                    <nue-div
                        v-for="subTask in subTasks"
                        :key="subTask.id"
                        class="subtask-row"
                        :data-done="subTask.state === 'done'"
                        align="center"
                        @click="switchTaskDetails(subTask.id)"
                    >
                        <nue-icon
                            :name="subTask.state === 'done' ? 'check-circle-fill' : 'circle'"
                            class="subtask-row__icon"
                        />
                        <nue-text :clamped="1" class="subtask-row__name">
                            {{ subTask.name }}
                        </nue-text>
                        <nue-icon name="arrow-right" class="subtask-row__arrow" />
                    </nue-div>
                </template>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#TodoDetailsSubTasksContainer {
    border-top: 1px solid var(--nue-divider-color);
    padding: 0.5rem;
    gap: 0.5rem;
    height: auto;
    overflow: unset;

    > .nue-header {
        height: auto;
        padding: 0.5rem;
        border: none;
        color: var(--nue-primary-color-900);
    }

    > .nue-main {
        height: auto;
        border: none;
        margin-bottom: 1rem;

        > .nue-content {
            display: flex;
            flex-direction: column;
            flex-wrap: nowrap;
            gap: 0.25rem;
            overflow: hidden;
        }
    }
}

.subtask-row {
    flex-wrap: nowrap;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: var(--nue-radius, 6px);
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
        background-color: var(--nue-primary-color-20);
    }

    .subtask-row__icon {
        font-size: 1.05em;
        line-height: 1;
        color: var(--nue-primary-color-400);
        flex: none;
    }

    &[data-done='true'] .subtask-row__icon {
        color: var(--nue-success-color-80, var(--nue-primary-color-600));
    }

    .subtask-row__name {
        flex: 1;
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-800);
    }

    &[data-done='true'] .subtask-row__name {
        text-decoration: line-through;
        color: var(--nue-primary-color-400);
    }

    .subtask-row__arrow {
        font-size: 0.9em;
        color: var(--nue-primary-color-300);
        flex: none;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    &:hover .subtask-row__arrow {
        opacity: 1;
    }
}
</style>

