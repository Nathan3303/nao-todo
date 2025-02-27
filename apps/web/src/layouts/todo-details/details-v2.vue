<template>
    <nue-div v-if="isGetting" align="center" height="100%" justify="center">
        <nue-icon color="gray" name="loading" spin />
        <nue-text color="gray" size="12px">加载中 ...</nue-text>
    </nue-div>
    <nue-container
        v-else-if="shadowTodo"
        :key="shadowTodo?.id"
        class="tasks-details-view"
        theme="vertical,inner"
    >
        <nue-header class="tasks-details-view__header">
            <nue-div align="center" width="auto" wrap="nowrap">
                <todo-check-button
                    :is-done="shadowTodo.state === 'done'"
                    @change="handleCheckTodo"
                />
                <nue-divider direction="vertical" />
                <todo-date-selector
                    v-model="shadowTodo.dueDate.endAt"
                    @change="handleChangeEndAt"
                />
            </nue-div>
            <nue-div align="center" width="auto" wrap="nowrap">
                <nue-button
                    :disabled="loadingState"
                    icon="clear"
                    theme="small"
                    @click="handleClose"
                >
                    关闭
                </nue-button>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-container theme="vertical,inner">
                <nue-header class="tasks-details-view__status">
                    <nue-div align="center" width="fit-content">
                        <todo-selector
                            :options="TodoStateSelectOptions"
                            :value="shadowTodo.state"
                            @change="handleChangeState"
                        />
                        <todo-selector
                            :options="TodoPrioritySelectOptions"
                            :value="shadowTodo.priority"
                            @change="handleChangePriority"
                        />
                    </nue-div>
                    <switch-button
                        v-model="shadowTodo.isFavorited"
                        active-icon="heart-fill"
                        active-text="取消收藏"
                        icon="heart"
                        size="small"
                        text="收藏"
                        @change="() => updateTodo()"
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
                            class="inputer--name"
                            placeholder="输入您的任务名称..."
                            style="padding: 0; flex: auto"
                            theme="noshape,large"
                            @change="updateTodo"
                        />
                        <nue-textarea
                            v-model="shadowTodo.description"
                            :rows="0"
                            autosize
                            placeholder="输入您的任务描述..."
                            style="padding: 0; flex: auto; color: #696969"
                            theme="noshape"
                            @change="updateTodo"
                        />
                    </nue-div>
                    <nue-div flex style="padding: 0 16px" vertical>
                        <todo-event-details :todo-id="shadowTodo.id" />
                    </nue-div>
                    <nue-div style="padding: 16px" vertical>
                        <todo-tag-bar
                            :tags="tagStore.tags"
                            :todo-tags="shadowTodo.tags"
                            @update-tags="handleUpdateTags"
                        />
                    </nue-div>
                    <nue-div v-if="commentsCount" class="todo-comments-wrapper">
                        <todo-comment-details />
                    </nue-div>
                </nue-main>
                <nue-footer height="auto" style="flex-direction: column; padding: 0; gap: 0">
                    <nue-div v-if="isCommenting" align="stretch" style="padding: 16px" vertical>
                        <comment-creator
                            :handler="handleLeaveComment"
                            @cancel="(isCommenting = false)"
                        />
                    </nue-div>
                    <nue-div v-else gap="8px" style="padding: 16px">
                        <details-row
                            v-if="shadowTodo?.updatedAt"
                            :text="eventsProgress.text"
                            flex="1"
                            label="检查事项进度"
                        />
                        <details-row
                            v-if="shadowTodo?.createdAt"
                            :text="formatDate(shadowTodo?.createdAt)"
                            flex="1"
                            label="创建时间"
                        />
                        <details-row
                            v-if="shadowTodo?.updatedAt"
                            :text="formatDate(shadowTodo?.updatedAt)"
                            flex="1"
                            label="最后修改时间"
                        />
                    </nue-div>
                </nue-footer>
            </nue-container>
        </nue-main>
        <nue-footer>
            <nue-div align="center" gap="4px" justify="space-between">
                <todo-project-selector
                    :project-id="shadowTodo.projectId"
                    :projects="projects"
                    :user-id="userStore.user?.id || ''"
                    placement="top-start"
                    @select="handleMoveToProject"
                />
                <nue-div gap="4px" width="fit-content" wrap="nowrap">
                    <nue-button icon="chat" theme="small" @click="handleStartLeaveComment">
                        评论
                    </nue-button>
                    <nue-button icon="files" theme="small" @click="handleDuplicateTodo">
                        复制
                    </nue-button>
                </nue-div>
                <nue-div gap="4px" width="fit-content" wrap="nowrap">
                    <nue-button
                        v-if="shadowTodo.isDeleted"
                        icon="delete"
                        size="small"
                        theme="error"
                        @click="handleDeleteTodoPermanently"
                    >
                        永久删除
                    </nue-button>
                    <todo-delete-button
                        :is-deleted="shadowTodo.isDeleted"
                        @delete="handleDeleteTodo"
                        @restore="handleRestoreTodo"
                    />
                </nue-div>
            </nue-div>
        </nue-footer>
    </nue-container>
    <nue-empty
        v-else
        description="选择左侧的任务以查看详细"
        image-size="64px"
        image-src="/images/to-do.png"
    />
</template>

<script lang="ts" setup>
import { nextTick, ref } from 'vue'
import { useTodoDetails } from './use-details'
import { useCommentDetails } from './use-comment-details'
import { useTagStore, useUserStore } from '@/stores'
import DetailsRow from './row.vue'
import { TodoCommentDetails, TodoEventDetails } from '@/layers'
import {
    TodoPrioritySelectOptions,
    TodoSelector,
    TodoStateSelectOptions
} from '@nao-todo/components/todo/selector'
import {
    CommentCreator,
    SwitchButton,
    TodoCheckButton,
    TodoDateSelector,
    TodoDeleteButton,
    TodoProjectSelector,
    TodoTagBar
} from '@nao-todo/components'
import { NueTextarea } from 'nue-ui'
import './details-v2.css'

defineOptions({ name: 'TodoDetailsV2' })

const userStore = useUserStore()
const tagStore = useTagStore()

const leaveCommentInputRef = ref<InstanceType<typeof NueTextarea>>()

const {
    projects,
    shadowTodo,
    loadingState,
    isGetting,
    eventsProgress,
    formatDate,
    updateTodo,
    handleChangeEndAt,
    handleChangeState,
    handleChangePriority,
    handleMoveToProject,
    handleClose,
    handleCheckTodo,
    handleDeleteTodo,
    handleDeleteTodoPermanently,
    handleRestoreTodo,
    handleUpdateTags,
    handleDuplicateTodo
} = useTodoDetails()
const { isCommenting, commentsCount, handleLeaveComment } = useCommentDetails()

const handleStartLeaveComment = () => {
    isCommenting.value = !isCommenting.value
    if (isCommenting.value) nextTick(() => leaveCommentInputRef.value?.innerInputRef.focus())
}
</script>
