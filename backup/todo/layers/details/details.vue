<template>
    <empty
        :empty="!shadowTodo"
        message="点击左侧列表中的任务以查看任务详细。"
        text-size="12px"
        full-height
    >
    </empty>
    <nue-container class="details-wrapper" v-if="shadowTodo" :key="shadowTodo?.id">
        <nue-header align="end" justify="space-between" height="48px">
            <nue-div align="center" width="fit-content" gap="8px" height="100%">
                <nue-text size="18px">任务详情</nue-text>
                <nue-div v-if="loadingState" width="fit-content" align="center" gap="4px">
                    <nue-icon name="loading" :spin="loadingState"></nue-icon>
                    <nue-text size="12px" color="gray">同步中...</nue-text>
                </nue-div>
            </nue-div>
            <nue-div width="fit-content" gap="8px" align="center" height="100%">
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
        <nue-main style="flex-direction: column; gap: 16px; padding: 16px 0">
            <template #content>
                <Loading v-if="loading" placeholder="正在加载任务详情..."></Loading>
                <empty v-else :empty="!shadowTodo" message="无法获取任务详情。">
                    <nue-div vertical align="stretch">
                        <details-row label="任务名称">
                            <nue-textarea
                                v-model="shadowTodo.name"
                                placeholder="输入您的任务名称..."
                                autosize
                                theme="noshape"
                                @blur="updateTodo"
                            ></nue-textarea>
                        </details-row>
                        <nue-divider></nue-divider>
                        <details-row :label="`检查事项 ${eventsProgress}`">
                            <todo-event-row
                                v-for="event in shadowTodo.events"
                                :key="event.id"
                                :event="event"
                                @update="handleUpdateTodoEvent"
                                @delete="handleDeleteTodoEvent"
                            ></todo-event-row>
                            <input-button
                                icon="plus-circle"
                                button-text="添加检查事项"
                                theme="pure,noshape"
                                :submit-on-blur="false"
                                @submit="handleInputButtonSubmit"
                            ></input-button>
                        </details-row>
                        <nue-divider></nue-divider>
                        <nue-div>
                            <details-row label="任务优先级" width="fit-content">
                                <nue-select
                                    v-model="shadowTodo.priority"
                                    size="small"
                                    @change="updateTodo"
                                >
                                    <nue-select-option label="低" value="low"></nue-select-option>
                                    <nue-select-option
                                        label="中"
                                        value="medium"
                                    ></nue-select-option>
                                    <nue-select-option label="高" value="high"></nue-select-option>
                                </nue-select>
                            </details-row>
                            <details-row label="任务状态" width="fit-content">
                                <nue-select
                                    v-model="shadowTodo.state"
                                    size="small"
                                    @change="updateTodo"
                                >
                                    <nue-select-option
                                        label="待办"
                                        value="todo"
                                    ></nue-select-option>
                                    <nue-select-option
                                        label="正在进行"
                                        value="in-progress"
                                    ></nue-select-option>
                                    <nue-select-option
                                        label="已完成"
                                        value="done"
                                    ></nue-select-option>
                                </nue-select>
                            </details-row>
                            <details-row label="收藏任务" width="fit-content">
                                <switch-button
                                    v-model="shadowTodo.isPinned"
                                    size="small"
                                    icon="heart"
                                    active-icon="heart-fill"
                                    text="收藏"
                                    active-text="取消收藏"
                                    @change="() => updateTodo()"
                                ></switch-button>
                            </details-row>
                            <details-row label="标记任务为结束" width="fit-content">
                                <switch-button
                                    v-model="shadowTodo.isDone"
                                    size="small"
                                    icon="square"
                                    active-icon="square-check-fill"
                                    text="标记为结束"
                                    active-text="取消结束"
                                    @change="() => updateTodo()"
                                ></switch-button>
                            </details-row>
                        </nue-div>
                        <nue-divider></nue-divider>
                        <details-row :label="`任务结束时间 ${dueDateHint}`">
                            <nue-div gap="4px" align="center">
                                <nue-button
                                    v-if="date.endAt === ''"
                                    theme="small"
                                    icon="plus"
                                    @click="handleSwitchEndDate(1)"
                                >
                                    添加结束时间
                                </nue-button>
                                <template v-else>
                                    <nue-input
                                        theme="small"
                                        type="datetime-local"
                                        v-model="date.endAt"
                                        @change="handleChangeDate"
                                        style="width: 180px"
                                    ></nue-input>
                                    <nue-button
                                        theme="small"
                                        icon="clear"
                                        @click="handleSwitchEndDate(0)"
                                    ></nue-button>
                                </template>
                            </nue-div>
                        </details-row>
                        <nue-divider></nue-divider>
                        <details-row label="任务描述">
                            <nue-textarea
                                v-model="shadowTodo.description"
                                placeholder="输入您的任务描述..."
                                :rows="0"
                                autosize
                                theme="noshape"
                                @blur="updateTodo"
                            ></nue-textarea>
                        </details-row>
                        <nue-divider></nue-divider>
                        <nue-div>
                            <details-row
                                v-if="shadowTodo?.createdAt"
                                label="创建时间"
                                :text="parseDate(shadowTodo?.createdAt)"
                                flex="1"
                            ></details-row>
                            <details-row
                                v-if="shadowTodo?.updatedAt"
                                label="最后修改时间"
                                :text="parseDate(shadowTodo?.updatedAt)"
                                flex="1"
                            ></details-row>
                        </nue-div>
                    </nue-div>
                </empty>
            </template>
        </nue-main>
        <nue-footer>
            <nue-dropdown theme="move-to-dropdown">
                <template #default="{ clickTrigger }">
                    <nue-button size="small" icon="switch" @click="clickTrigger">
                        {{ shadowTodo.project?.title || '收集箱' }}
                    </nue-button>
                </template>
                <template #dropdown>
                    <nue-button
                        theme="pure,small"
                        v-for="project in projects"
                        :data-selected="project.id === shadowTodo.projectId"
                        @click="handleMoveToProject(project.id)"
                    >
                        {{ project.title }}
                        <template #append>
                            <nue-icon name="check"></nue-icon>
                        </template>
                    </nue-button>
                </template>
            </nue-dropdown>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import { useTodoDetails } from './use-details'
import { Loading, Empty, InputButton, TodoEventRow, SwitchButton } from '@/components'
import DetailsRow from './row.vue'

const props = defineProps<TodoDetailsProps>()
const emit = defineEmits<TodoDetailsEmits>()

const {
    projects,
    shadowTodo,
    loadingState,
    date,
    dueDateHint,
    eventsProgress,
    parseDate,
    updateTodo,
    handleChangeDate,
    handleSwitchEndDate,
    handleInputButtonSubmit,
    handleUpdateTodoEvent,
    handleDeleteTodoEvent,
    handleClose,
    handleMoveToProject
} = useTodoDetails(props, emit)
</script>

<style scoped>
@import url('./details.css');
</style>
