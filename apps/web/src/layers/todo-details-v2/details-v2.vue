<template>
    <nue-div v-if="isGetting" align="center" height="100%" justify="center">
        <nue-icon color="gray" name="loading" spin />
        <nue-text color="gray" size="12px">加载中 ...</nue-text>
    </nue-div>
    <nue-container
        v-else-if="shadowTodo"
        id="tasks/details"
        :key="shadowTodo?.id"
        theme="vertical,inner"
    >
        <nue-header height="auto" style="justify-content: space-between; box-sizing: border-box">
            <nue-div align="center" width="fit-content" wrap="nowrap">
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
            <nue-div align="center" width="fit-content" wrap="nowrap">
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
                <nue-header height="auto" style="justify-content: space-between">
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
                </nue-header>
                <nue-main class="todo-details__main-content">
                    <nue-div class="details-v2__progress">
                        <nue-progress
                            :percentage="eventsProgress.percentage"
                            :stroke-width="2"
                            hide-text
                        />
                    </nue-div>
                    <nue-div align="stretch" gap="0px" style="padding: 16px" vertical>
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
                        <nue-textarea
                            ref="leaveCommentInputRef"
                            v-model="commentContent"
                            :rows="0"
                            autosize
                            placeholder="添加评论"
                            theme="small"
                            @keydown.enter.exact="handleLeaveComment"
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
        <nue-footer style="justify-content: space-between">
            <todo-project-selector
                :project-id="shadowTodo.projectId"
                :projects="projects"
                :user-id="userStore.user!.id"
                @select="handleMoveToProject"
            />
            <nue-button icon="chat" theme="small" @click="handleStartLeaveComment">
                评论
            </nue-button>
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
        </nue-footer>
    </nue-container>
    <nue-empty v-else description="点击左侧列表中的任务查看详细" image-src="/images/to-do.png" />
</template>

<script lang="ts" setup>
import { ref, nextTick } from 'vue'
import { useTodoDetails } from './use-details'
import { useCommentDetails } from './use-comment-details'
import { useTagStore, useUserStore } from '@/stores'
import DetailsRow from './row.vue'
import { TodoEventDetails, TodoCommentDetails } from '@/layers'
import {
    TodoPrioritySelectOptions,
    TodoSelector,
    TodoStateSelectOptions
} from '@nao-todo/components/todo/selector'
import {
    SwitchButton,
    TodoCheckButton,
    TodoDateSelector,
    TodoDeleteButton,
    TodoProjectSelector,
    TodoTagBar
} from '@nao-todo/components'
import { NueTextarea } from 'nue-ui'

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
    handleUpdateTags
} = useTodoDetails()
const { isCommenting, commentContent, commentsCount, handleLeaveComment, handleEnterNewLine } =
    useCommentDetails()

const handleStartLeaveComment = () => {
    isCommenting.value = !isCommenting.value
    if (isCommenting.value) nextTick(() => leaveCommentInputRef.value?.innerInputRef.focus())
}
</script>

<style scoped>
.nue-empty {
    height: 100%;
}

.nue-main:deep(.nue-main__content) {
    align-items: start;
    gap: 16px;
}

.details-v2__progress {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
}

.todo-details__main-content:deep(> .nue-main__content) {
    padding: 0;
    gap: 0;
}

.todo-comments-wrapper {
    border-top: 1px solid var(--divider-color);
    padding: 8px;
}
</style>
