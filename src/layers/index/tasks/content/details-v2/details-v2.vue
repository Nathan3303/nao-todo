<template>
    <empty
        :empty="!shadowTodo"
        message="点击左侧列表中的任务以查看任务详细。"
        text-size="12px"
        full-height
    >
    </empty>
    <nue-container class="details-wrapper" v-if="shadowTodo" :key="shadowTodo?.id">
        <nue-header>
            <nue-div align="center" wrap="nowrap" width="fit-content">
                <nue-button theme="pure" icon="square"></nue-button>
                <nue-divider direction="vertical"></nue-divider>
                <nue-div class="date-selector" gap="4px" align="center">
                    <nue-button
                        v-if="date.endAt === ''"
                        theme="small,pure"
                        @click="handleSwitchEndDate(1)"
                    >
                        设置结束时间
                    </nue-button>
                    <template v-else>
                        <nue-input
                            theme="small,noshape"
                            type="datetime-local"
                            v-model="date.endAt"
                            @change="handleChangeDate"
                        ></nue-input>
                        <nue-button
                            theme="small,pure"
                            icon="clear"
                            @click="handleSwitchEndDate(0)"
                        ></nue-button>
                    </template>
                </nue-div>
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
                    <nue-select v-model="shadowTodo.priority" size="small" @change="updateTodo">
                        <nue-select-option label="低" value="low"></nue-select-option>
                        <nue-select-option label="中" value="medium"></nue-select-option>
                        <nue-select-option label="高" value="high"></nue-select-option>
                    </nue-select>
                    <nue-select v-model="shadowTodo.state" size="small" @change="updateTodo">
                        <nue-select-option label="待办" value="todo"></nue-select-option>
                        <nue-select-option label="正在进行" value="in-progress"></nue-select-option>
                        <nue-select-option label="已完成" value="done"></nue-select-option>
                    </nue-select>
                </nue-div>
                <switch-button
                    v-model="shadowTodo.isPinned"
                    size="small"
                    icon="heart"
                    active-icon="heart-fill"
                    text="收藏"
                    active-text="取消收藏"
                    @change="() => updateTodo()"
                ></switch-button>
            </nue-div>
            <nue-divider></nue-divider>
            <nue-div vertical gap="0px" align="stretch">
                <nue-textarea
                    class="inputer--name"
                    v-model="shadowTodo.name"
                    placeholder="输入您的任务名称..."
                    autosize
                    theme="noshape,large"
                    @blur="updateTodo"
                ></nue-textarea>
                <nue-textarea
                    v-model="shadowTodo.description"
                    placeholder="输入您的任务描述..."
                    :rows="0"
                    autosize
                    theme="noshape"
                    @blur="updateTodo"
                ></nue-textarea>
            </nue-div>
            <nue-div vertical gap="4px">
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
            </nue-div>
            <nue-div flex></nue-div>
            <nue-divider></nue-divider>
            <nue-div>
                <nue-text size="12px">标签栏</nue-text>
            </nue-div>
            <nue-divider></nue-divider>
            <nue-div gap="8px">
                <details-row
                    v-if="shadowTodo?.updatedAt"
                    label="检查事项进度"
                    :text="eventsProgress"
                    flex="1"
                ></details-row>
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
            <nue-div wrap="nowrap" width="fit-content" gap="4px">
                <switch-button
                    v-model="shadowTodo.isDone"
                    size="small"
                    icon="square"
                    active-icon="square-check-fill"
                    text="标记为结束"
                    active-text="取消结束"
                    @change="() => updateTodo()"
                ></switch-button>
                <nue-button theme="small" icon="delete">删除任务</nue-button>
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import type { TodoDetailsEmits, TodoDetailsProps } from './types'
import { useTodoDetails } from './use-details'
import { Loading, Empty, InputButton, TodoEventRow, SwitchButton } from '@/components'
import DetailsRow from './row.vue'

defineOptions({ name: 'ContentTodoDetailsV2' })
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
@import url('./details-v2.css');
</style>
