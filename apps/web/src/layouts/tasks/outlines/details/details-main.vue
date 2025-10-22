<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { DetailsRow, DetailsMainComments, DetailsMainEvents } from '.'
import { useTasksDataStore } from '@/stores/tasks'
import { useRelativeDate } from '@nao-todo/hooks'
import {
    CommentCreator,
    SwitchButton,
    TodoPrioritySelectOptions,
    TodoSelector,
    TodoStateSelectOptions,
    TodoTagBar
} from '@nao-todo/components'
import type { DetailsMainEmits, DetailsMainProps } from './types'
import type { Todo } from '@nao-todo/types'

defineProps<DetailsMainProps>()
const emit = defineEmits<DetailsMainEmits>()

const tasksDataStore = useTasksDataStore()

const { tags } = storeToRefs(tasksDataStore)
</script>

<template>
    <nue-container id="TasksTodoDetailsMainContainer" v-if="shadowTodo">
        <nue-header>
            <nue-div wrap="nowrap" justify="space-between">
                <nue-div align="center" width="auto">
                    <todo-selector
                        :options="TodoStateSelectOptions"
                        :value="shadowTodo.state"
                        @change="(v) => emit('updateTodoState', v as Todo['state'])"
                    />
                    <todo-selector
                        :options="TodoPrioritySelectOptions"
                        :value="shadowTodo.priority"
                        @change="(v) => emit('updateTodoPriority', v as Todo['priority'])"
                    />
                </nue-div>
                <switch-button
                    v-model="shadowTodo.isFavorited"
                    active-icon="heart-fill"
                    active-text="取消收藏"
                    icon="heart"
                    size="small"
                    text="收藏"
                    @change="emit('update', 'isFavorited')"
                />
                <nue-div class="tasks-details-view__progress">
                    <nue-progress
                        :percentage="eventsProgress.percentage"
                        :stroke-width="2"
                        hide-text
                    />
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-div vertical wrap="nowrap" height="100%">
                    <nue-div theme="name-desc" spellcheck="false">
                        <nue-textarea
                            v-model="shadowTodo.name"
                            :autosize="{ minRows: 1, maxRows: 2 }"
                            maxlength="64"
                            placeholder="输入您的任务名称..."
                            theme="noshape,name"
                            @change="emit('update', 'name')"
                        />
                        <nue-textarea
                            v-model="shadowTodo.description"
                            :autosize="{ minRows: 1, maxRows: 4 }"
                            maxlength="256"
                            placeholder="输入您的任务描述..."
                            theme="noshape,description"
                            @change="emit('update', 'description')"
                        />
                    </nue-div>
                    <nue-div vertical style="padding: 0 1rem; flex: 1">
                        <details-main-events />
                    </nue-div>
                    <nue-div vertical style="padding: 1rem">
                        <todo-tag-bar
                            :tags="tags"
                            :todo-tags="shadowTodo.tags"
                            @update-tags="(v) => emit('updateTodoTags', v as Todo['tags'])"
                        />
                    </nue-div>
                    <details-main-comments />
                    <nue-div class="tasks-details-view__deleted-tag" v-if="shadowTodo.isDeleted">
                        任务已删除
                    </nue-div>
                    <nue-div class="tasks-details-view__giveup-tag" v-if="shadowTodo.isGivenUp">
                        任务已放弃
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-div v-if="isCommenting" align="stretch" vertical>
                <comment-creator
                    :handler="leaveCommentHandler"
                    @cancel="emit('cancelLeaveComment')"
                />
            </nue-div>
            <nue-div v-else wrap="nowrap" justify="space-between">
                <details-row :text="eventsProgress.text" label="检查事项进度" flex="40%" />
                <details-row
                    v-if="shadowTodo.createdAt"
                    :text="useRelativeDate(shadowTodo.createdAt)"
                    flex="30%"
                    label="创建时间"
                />
                <details-row
                    v-if="shadowTodo.updatedAt"
                    :text="useRelativeDate(shadowTodo.updatedAt)"
                    flex="30%"
                    label="最后修改时间"
                />
                <!-- <details-row :text="statusText" flex="15%" label="状态" /> -->
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksTodoDetailsMainContainer {
    width: 100%;
    height: 100%;
    overflow: hidden;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        width: 100%;
        height: auto;
        padding: 0;
    }

    > .nue-header {
        padding: 1rem;
        height: auto;
        border: none;
    }

    > .nue-footer {
        padding: 1rem;
        height: auto;
    }

    .nue-div--name-desc {
        /*  vertical align="stretch" wrap="nowrap" */
        flex-direction: column;
        flex-wrap: nowrap;
        align-items: stretch;
        padding: 1rem;
        width: 100%;
        box-sizing: border-box;

        .nue-textarea:deep().word-counter {
            font-size: var(--nue-text-xs);
            background-color: transparent;
        }

        .nue-textarea:deep().nue-textarea__textarea {
            --nue-textarea-overflow: hidden;
            --nue-textarea-min-width: 100%;
            word-break: break-all;
            white-space: pre-wrap;
            white-space-collapse: break-all;
        }

        .nue-textarea--name {
            --nue-textarea-font-size: var(--nue-text-df);
            --nue-textarea-color: var(--nue-primary-color-800);
        }

        .nue-textarea--description {
            --nue-textarea-font-size: var(--nue-text-sm);
            --nue-textarea-color: var(--nue-primary-color-500);
        }
    }

    .tasks-details-view__progress {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
    }

    .tasks-details-view__giveup-tag {
        display: flex;
        font-size: 0.75rem;
        height: 32px;
        line-height: 32px;
        background-color: #ff7b47;
        color: white;
        justify-content: center;
    }

    .tasks-details-view__deleted-tag {
        display: flex;
        font-size: 0.75rem;
        height: 32px;
        line-height: 32px;
        background-color: #ff4747;
        color: white;
        justify-content: center;
    }
}
</style>
