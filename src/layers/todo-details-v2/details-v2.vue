<template>
    <nue-div v-if="isGetting" height="100%" align="center" justify="center">
        <nue-icon name="loading" color="gray" spin />
        <nue-text size="12px" color="gray">加载中 ...</nue-text>
    </nue-div>
    <nue-container
        v-else-if="shadowTodo"
        id="tasks/details"
        theme="vertical,inner"
        :key="shadowTodo?.id"
    >
        <nue-header height="auto" style="justify-content: space-between; box-sizing: border-box">
            <nue-div align="center" wrap="nowrap" width="fit-content">
                <todo-check-button :is-done="shadowTodo.isDone" @change="handleCheckTodo" />
                <nue-divider direction="vertical" />
                <todo-date-selector :date="shadowTodo.dueDate.endAt" @change="handleChangeEndAt" />
            </nue-div>
            <nue-div align="center" wrap="nowrap" width="fit-content">
                <nue-button
                    theme="small"
                    icon="clear"
                    :disabled="loadingState"
                    @click="handleClose"
                >
                    关闭
                </nue-button>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-container theme="vertical,inner">
                <nue-header height="auto" style="justify-content: space-between">
                    <nue-div width="fit-content" align="center">
                        <todo-selector
                            :value="shadowTodo.state"
                            :options="TodoStateSelectOptions"
                            @change="handleChangeState"
                        />
                        <todo-selector
                            :value="shadowTodo.priority"
                            :options="TodoPrioritySelectOptions"
                            @change="handleChangePriority"
                        />
                    </nue-div>
                    <switch-button
                        v-model="shadowTodo.isPinned"
                        size="small"
                        icon="heart"
                        active-icon="heart-fill"
                        text="收藏"
                        active-text="取消收藏"
                        @change="() => updateTodo()"
                    />
                </nue-header>
                <nue-main>
                    <nue-div class="details-v2__progress">
                        <nue-progress
                            :percentage="eventsProgress.percentage"
                            :stroke-width="2"
                            hide-text
                        />
                    </nue-div>
                    <nue-div vertical gap="0px" align="stretch">
                        <nue-textarea
                            class="inputer--name"
                            v-model="shadowTodo.name"
                            placeholder="输入您的任务名称..."
                            autosize
                            theme="noshape,large"
                            @change="updateTodo"
                            style="padding: 0px; flex: auto"
                        />
                        <nue-textarea
                            v-model="shadowTodo.description"
                            placeholder="输入您的任务描述..."
                            :rows="0"
                            autosize
                            theme="noshape"
                            @change="updateTodo"
                        />
                    </nue-div>
                    <todo-event-details :todo-id="shadowTodo.id" />
                    <nue-div flex />
                    <todo-tag-bar
                        :tags="tagStore.tags"
                        :todo-tags="shadowTodo.tags"
                        @update-tags="handleUpdateTags"
                    />
                </nue-main>
                <nue-footer>
                    <nue-div gap="8px">
                        <details-row
                            v-if="shadowTodo?.updatedAt"
                            label="检查事项进度"
                            :text="eventsProgress.text"
                            flex="1"
                        />
                        <details-row
                            v-if="shadowTodo?.createdAt"
                            label="创建时间"
                            :text="formatDate(shadowTodo?.createdAt)"
                            flex="1"
                        />
                        <details-row
                            v-if="shadowTodo?.updatedAt"
                            label="最后修改时间"
                            :text="formatDate(shadowTodo?.updatedAt)"
                            flex="1"
                        />
                    </nue-div>
                </nue-footer>
            </nue-container>
        </nue-main>
        <nue-footer style="justify-content: space-between">
            <todo-project-selector
                :user-id="userStore.user!.id"
                :projects="projects"
                :project-id="shadowTodo.projectId"
                :project-title="shadowTodo.project?.title"
                @select="handleMoveToProject"
            />
            <nue-div wrap="nowrap" width="fit-content" gap="4px">
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

<script setup lang="ts">
import { useTodoDetails } from './use-details'
import { useUserStore, useTagStore } from '@/stores'
import DetailsRow from './row.vue'
import { TodoEventDetails } from '@/layers'
import {
    TodoSelector,
    TodoStateSelectOptions,
    TodoPrioritySelectOptions
} from '@/components/todo/selector'
import {
    SwitchButton,
    TodoDateSelector,
    TodoDeleteButton,
    TodoCheckButton,
    TodoProjectSelector,
    TodoTagBar
} from '@/components'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import { ref } from 'vue'

defineOptions({ name: 'ContentTodoDetailsV2' })
const props = defineProps<TodoDetailsProps>()
const emit = defineEmits<TodoDetailsEmits>()

const userStore = useUserStore()
const tagStore = useTagStore()

const eventFlag = ref(false)

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
    handleRestoreTodo,
    handleUpdateTags
} = useTodoDetails(props, emit)
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
</style>
