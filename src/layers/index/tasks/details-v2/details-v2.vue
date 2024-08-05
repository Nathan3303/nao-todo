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
                <nue-button
                    theme="pure"
                    :icon="shadowTodo.isDone ? 'square-check-fill' : 'square'"
                    @click="handleCheckTodo"
                ></nue-button>
                <nue-divider direction="vertical"></nue-divider>
                <todo-date-selector
                    :date="shadowTodo.dueDate.endAt"
                    @change="handleChangeEndAt"
                ></todo-date-selector>
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
                    ></todo-selector>
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
            <todo-event-details :todo-id="shadowTodo.id"></todo-event-details>
            <nue-div flex></nue-div>
            <todo-tag-details></todo-tag-details>
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
                <nue-button theme="small" icon="delete">删除任务</nue-button>
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { useTodoDetails } from './use-details'
import { Empty, SwitchButton, TodoDateSelector, TodoSelector } from '@/components'
import { TodoEventDetails, TodoTagDetails } from '@/layers/index'
import DetailsRow from './row.vue'
import type { TodoDetailsEmits, TodoDetailsProps } from './types'

defineOptions({ name: 'ContentTodoDetailsV2' })
const props = defineProps<TodoDetailsProps>()
const emit = defineEmits<TodoDetailsEmits>()

const {
    projects,
    shadowTodo,
    loadingState,
    eventsProgress,
    parseDate,
    updateTodo,
    handleChangeEndAt,
    handleChangePriority,
    handleChangeState,
    handleClose,
    handleMoveToProject,
    handleCheckTodo
} = useTodoDetails(props, emit)
</script>

<style scoped>
@import url('./details-v2.css');
</style>
