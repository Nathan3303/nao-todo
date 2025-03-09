<script setup lang="ts">
import moment from 'moment/moment'
import {
    CommentCreator,
    SwitchButton,
    TodoPrioritySelectOptions,
    TodoSelector,
    TodoStateSelectOptions,
    TodoTagBar
} from '@nao-todo/components'
import DetailsRow from './details-row.vue'
import DetailsMainComments from './details-main-comments.vue'
import DetailsMainEvents from './details-main-events.vue'
import { useTagStore } from '@/stores'
import type { DetailsMainEmits, DetailsMainProps } from './types'
import type { Todo } from '@nao-todo/types'

defineProps<DetailsMainProps>()
const emit = defineEmits<DetailsMainEmits>()

const tagStore = useTagStore()

const formatDate = (dateString: string) => {
    return moment(dateString).format('YYYY-MM-DD HH:mm')
}
</script>

<template>
    <nue-main class="tasks-details-view__main" v-if="shadowTodo">
        <nue-container theme="vertical,inner">
            <nue-header class="tasks-details-view__status">
                <nue-div align="center" width="fit-content">
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
                    @change="emit('update')"
                />
                <nue-div class="tasks-details-view__progress">
                    <nue-progress
                        :percentage="eventsProgress.percentage"
                        :stroke-width="2"
                        hide-text
                    />
                </nue-div>
            </nue-header>
            <nue-main style="border-top: none">
                <nue-div align="stretch" style="padding: 16px" vertical>
                    <nue-textarea
                        v-model="shadowTodo.name"
                        autosize
                        placeholder="输入您的任务名称..."
                        style="padding: 0; flex: auto"
                        theme="noshape,large"
                        @change="emit('update')"
                    />
                    <nue-textarea
                        v-model="shadowTodo.description"
                        :rows="0"
                        autosize
                        placeholder="输入您的任务描述..."
                        style="padding: 0; flex: auto; color: #696969"
                        theme="noshape"
                        @change="emit('update')"
                    />
                </nue-div>
                <nue-div flex="1" style="padding: 0 16px" vertical>
                    <details-main-events :todo-id="shadowTodo.id" />
                </nue-div>
                <nue-div style="padding: 16px" vertical>
                    <todo-tag-bar
                        :tags="tagStore.tags"
                        :todo-tags="shadowTodo.tags"
                        @update-tags="(v) => emit('updateTodoTags', v as Todo['tags'])"
                    />
                </nue-div>
                <nue-div v-if="commentsCount" class="todo-comments-wrapper">
                    <details-main-comments />
                </nue-div>
            </nue-main>
            <nue-footer height="auto" style="flex-direction: column; padding: 0; gap: 0">
                <nue-div v-if="isCommenting" align="stretch" style="padding: 16px" vertical>
                    <comment-creator
                        :handler="leaveCommentHandler"
                        @cancel="emit('cancelLeaveComment')"
                    />
                </nue-div>
                <nue-div v-else gap="8px" style="padding: 16px">
                    <details-row
                        v-if="shadowTodo.updatedAt"
                        :text="eventsProgress.text"
                        flex="1"
                        label="检查事项进度"
                    />
                    <details-row
                        v-if="shadowTodo.createdAt"
                        :text="formatDate(shadowTodo.createdAt)"
                        flex="1"
                        label="创建时间"
                    />
                    <details-row
                        v-if="shadowTodo.updatedAt"
                        :text="formatDate(shadowTodo.updatedAt)"
                        flex="1"
                        label="最后修改时间"
                    />
                </nue-div>
            </nue-footer>
        </nue-container>
    </nue-main>
</template>

<style scoped>
.tasks-details-view__main:deep(.nue-main__content) {
    align-items: start;
    padding: 0;
    gap: 0;
    overflow: hidden;
    overflow-y: auto;
}

.tasks-details-view__status {
    height: auto !important;
    padding-bottom: 0 !important;
    justify-content: space-between;
}

.tasks-details-view__progress {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
}

.todo-comments-wrapper {
    border-top: 1px solid var(--divider-color);
    padding: 8px;
}
</style>
