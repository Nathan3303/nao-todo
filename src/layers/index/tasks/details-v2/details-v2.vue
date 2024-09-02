<template>
    <empty
        :empty="!shadowTodo"
        message="点击左侧列表中的任务以查看任务详细。"
        text-size="12px"
        full-height
    />
    <nue-container class="details-wrapper" v-if="shadowTodo" :key="shadowTodo?.id">
        <nue-header>
            <nue-div align="center" wrap="nowrap" width="fit-content">
                <todo-check-button :is-done="shadowTodo.isDone" @change="handleCheckTodo" />
                <nue-divider direction="vertical"></nue-divider>
                <todo-date-selector :date="shadowTodo.dueDate.endAt" @change="handleChangeEndAt" />
            </nue-div>
            <nue-div align="center" wrap="nowrap" width="fit-content">
                <nue-button
                    theme="small"
                    @click="handleClose"
                    icon="clear"
                    :disabled="loadingState"
                >
                    关闭
                </nue-button>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-div justify="space-between">
                <nue-div width="fit-content" align="center">
                    <todo-selector
                        :value="shadowTodo.priority"
                        :options="[
                            { label: '低', value: 'low' },
                            { label: '中', value: 'medium' },
                            { label: '高', value: 'high' }
                        ]"
                        @change="handleChangePriority"
                    />
                    <todo-selector
                        :value="shadowTodo.state"
                        :options="[
                            { label: '代办', value: 'todo' },
                            { label: '正在进行', value: 'in-progress' },
                            { label: '已完成', value: 'done' }
                        ]"
                        @change="handleChangeState"
                    ></todo-selector>
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
            </nue-div>
            <nue-divider />
            <div>
                <nue-progress :percentage="eventsProgress.percentage" :stroke-width="2" hide-text />
            </div>
            <nue-div vertical gap="0px" align="stretch">
                <nue-textarea
                    class="inputer--name"
                    v-model="shadowTodo.name"
                    placeholder="输入您的任务名称..."
                    autosize
                    theme="noshape,large"
                    @blur="updateTodo"
                />
                <nue-textarea
                    v-model="shadowTodo.description"
                    placeholder="输入您的任务描述..."
                    :rows="0"
                    autosize
                    theme="noshape"
                    @blur="updateTodo"
                />
            </nue-div>
            <todo-event-details :todo-id="shadowTodo.id" />
            <nue-div flex />
            <todo-tag-details
                :todo-id="shadowTodo.id"
                :todo-tags="shadowTodo.tags || []"
                @update-tags="handleUpdateTags"
            />
            <nue-divider />
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
        </nue-main>
        <nue-footer>
            <nue-dropdown theme="move-to-dropdown" :hide-on-click="false">
                <template #default="{ clickTrigger }">
                    <nue-button size="small" icon="switch" @click="clickTrigger">
                        {{ shadowTodo.project?.title || '收集箱' }}
                    </nue-button>
                </template>
                <template #dropdown>
                    <nue-div
                        class="nue-dropdown-item"
                        @click="handleMoveToProject(userStore.user!.id, '')"
                        gap="8px"
                        align="center"
                    >
                        <nue-icon name="inbox" size="12px" />
                        <nue-text size="12px" style="flex: auto">收集箱</nue-text>
                        <nue-icon v-if="shadowTodo.projectId === userStore.user!.id" name="check" />
                    </nue-div>
                    <nue-divider />
                    <nue-div
                        v-for="project in projects"
                        class="nue-dropdown-item"
                        @click="handleMoveToProject(project.id, project.title)"
                        style="min-width: 128px"
                        gap="8px"
                        align="center"
                    >
                        <nue-icon name="more2" size="12px" />
                        <nue-text size="12px" style="flex: auto">{{ project.title }}</nue-text>
                        <nue-icon v-if="project.id === shadowTodo.projectId" name="check" />
                    </nue-div>
                </template>
            </nue-dropdown>
            <nue-div wrap="nowrap" width="fit-content" gap="4px">
                <todo-delete-button
                    :is-deleted="shadowTodo.isDeleted"
                    @delete="handleDeleteTodo"
                    @restore="handleRestoreTodo"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { useTodoDetails } from './use-details'
import {
    Empty,
    SwitchButton,
    TodoDateSelector,
    TodoSelector,
    TodoDeleteButton,
    TodoCheckButton
} from '@/components'
import { TodoEventDetails, TodoTagDetails } from '@/layers/index'
import { useUserStore } from '@/stores'
import DetailsRow from './row.vue'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'

defineOptions({ name: 'ContentTodoDetailsV2' })
const props = defineProps<TodoDetailsProps>()
const emit = defineEmits<TodoDetailsEmits>()

const userStore = useUserStore()

const {
    projects,
    shadowTodo,
    loadingState,
    eventsProgress,
    formatDate,
    updateTodo,
    handleChangeEndAt,
    handleChangeState,
    handleChangePriority,
    handleClose,
    handleMoveToProject,
    handleCheckTodo,
    handleDeleteTodo,
    handleRestoreTodo,
    handleUpdateTags
} = useTodoDetails(props, emit)
</script>

<style scoped>
@import url('./details-v2.css');
</style>
