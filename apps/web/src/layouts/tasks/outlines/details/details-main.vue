<script setup lang="ts">
import {
    CommentCreator,
    SwitchButton,
    TodoPrioritySelectOptions,
    TodoSelector,
    TodoStateSelectOptions,
    TodoTagBar
} from '@nao-todo/components'
import { DetailsRow, DetailsMainComments, DetailsMainEvents } from '.'
import { useTagStore } from '@/stores/global'
import { useRelativeDate } from '@nao-todo/hooks'
import type { DetailsMainEmits, DetailsMainProps } from './types'
import type { Todo } from '@nao-todo/types'

defineProps<DetailsMainProps>()
const emit = defineEmits<DetailsMainEmits>()

const tagStore = useTagStore()
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
                <nue-div vertical gap="0" height="100%">
                    <nue-div vertical align="stretch" wrap="nowrap" style="padding: 1rem">
                        <nue-textarea
                            v-model="shadowTodo.name"
                            autosize
                            placeholder="输入您的任务名称..."
                            theme="noshape,name"
                            @change="emit('update', 'name')"
                        />
                        <nue-textarea
                            v-model="shadowTodo.description"
                            :rows="0"
                            autosize
                            placeholder="输入您的任务描述..."
                            theme="noshape,description"
                            @change="emit('update', 'description')"
                        />
                    </nue-div>
                    <nue-div vertical style="padding: 0 1rem" width="auto">
                        <details-main-events :todo-id="shadowTodo.id" />
                    </nue-div>
                    <nue-div vertical style="padding: 1rem; margin-top: auto">
                        <todo-tag-bar
                            :tags="tagStore.tags"
                            :todo-tags="shadowTodo.tags"
                            @update-tags="(v) => emit('updateTodoTags', v as Todo['tags'])"
                        />
                    </nue-div>
                    <nue-div v-if="commentsCount" class="todo-comments-wrapper">
                        <details-main-comments />
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
                <details-row :text="eventsProgress.text" label="检查事项进度" />
                <details-row
                    v-if="shadowTodo.createdAt"
                    :text="useRelativeDate(shadowTodo.createdAt)"
                    label="创建时间"
                />
                <details-row
                    v-if="shadowTodo.updatedAt"
                    :text="useRelativeDate(shadowTodo.updatedAt)"
                    label="最后修改时间"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksTodoDetailsMainContainer {
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

.todo-comments-wrapper {
    border-top: 1px solid var(--nue-divider-color);
    padding: 8px;
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
</style>
