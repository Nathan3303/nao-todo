<script setup lang="ts">
import { inject } from 'vue'
import DetailsRow from './row.vue'
import DetailsMainComments from './comments.vue'
import DetailsMainEvents from './events.vue'
import { CommentCreator, SwitchButton, TaskSelector, TaskTagBar } from '@nao-todo/components'
import {
    TaskPrioritySelectOptions,
    TaskStateSelectOptions
} from '@nao-todo/infrastructure/consts/tasks'
import { TASK_DETAILS_CONTEXT_KEY } from '../constants'
import type { TaskDetailsContext } from '../types'
import type { TaskViewObject } from '@nao-todo/types'
import { parse2RelativeDate } from '@nao-todo/infrastructure/utils'

const { vo, eventProgress, isCommenting, commentHandler, taskHandler, tags } =
    inject<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY)!

const updateTaskState = (v: unknown) => {
    if (vo.value === null) return
    taskHandler.updateTask(vo.value.id, { state: v as TaskViewObject['state'] })
}

const updateTaskPriority = (v: unknown) => {
    if (vo.value === null) return
    taskHandler.updateTask(vo.value.id, { priority: v as TaskViewObject['priority'] })
}

const updateTaskIsStarMark = (v: unknown) => {
    if (vo.value === null) return
    taskHandler.updateTask(vo.value.id, { isStarMarked: v as TaskViewObject['isStarMarked'] })
}

const updateTaskName = () => {
    if (vo.value === null) return
    taskHandler.updateTaskName(vo.value.id, vo.value.name as TaskViewObject['name'])
}

const updateTaskDescription = () => {
    if (vo.value === null) return
    taskHandler.updateTaskDescription(
        vo.value.id,
        vo.value.description as TaskViewObject['description']
    )
}

const updateTaskTags = (v: unknown) => {
    if (vo.value === null) return
    taskHandler.updateTask(vo.value.id, { tags: v as TaskViewObject['tags'] })
}

const createCommentHandler = async (content: string) => {
    if (vo.value === null) return false
    return await commentHandler.createComment(vo.value.id, content)
}
</script>

<template>
    <nue-container id="TasksTodoDetailsMainContainer" v-if="vo">
        <nue-header>
            <nue-div flex="1">
                <nue-div flex="1">
                    <task-selector
                        :options="TaskStateSelectOptions"
                        :value="vo.state"
                        @change="updateTaskState"
                    />
                    <task-selector
                        :options="TaskPrioritySelectOptions"
                        :value="vo.priority"
                        @change="updateTaskPriority"
                    />
                </nue-div>
                <nue-div>
                    <switch-button
                        v-model="vo.isStarMarked"
                        active-icon="heart-fill"
                        active-text="取消收藏"
                        icon="heart"
                        size="small"
                        text="收藏"
                        @change="updateTaskIsStarMark"
                    />
                </nue-div>
                <nue-div class="tasks-details-view__progress">
                    <nue-progress
                        :percentage="eventProgress.percentage"
                        :stroke-width="2"
                        hide-text
                    />
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div theme="name-desc">
                    <nue-textarea
                        v-model="vo.name"
                        :autosize="{ minRows: 1, maxRows: 2 }"
                        maxlength="64"
                        placeholder="输入您的任务名称..."
                        theme="pure,name"
                        @change="updateTaskName"
                    />
                    <nue-textarea
                        v-model="vo.description"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        maxlength="256"
                        placeholder="输入您的任务描述..."
                        theme="pure,description"
                        @change="updateTaskDescription"
                    />
                </nue-div>
                <nue-div vertical style="padding: 0 1rem">
                    <details-main-events />
                </nue-div>
                <nue-div flex="1"></nue-div>
                <nue-div vertical style="padding: 1rem">
                    <task-tag-bar :tags="tags" :task-tags="vo.tags" @update-tags="updateTaskTags" />
                </nue-div>
                <details-main-comments />
                <nue-div class="tasks-details-view__deleted-tag" v-if="vo.isDeleted">
                    任务于 {{ parse2RelativeDate(vo.deletedAt!) }} 删除
                </nue-div>
                <nue-div class="tasks-details-view__giveup-tag" v-if="vo.isGivenUp">
                    任务于 {{ parse2RelativeDate(vo.givenUpAt!) }} 放弃
                </nue-div>
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-div v-if="isCommenting" vertical width="100%">
                <comment-creator :handler="createCommentHandler" @cancel="isCommenting = false" />
            </nue-div>
            <nue-div justify="space-between" width="100%" overflow="auto">
                <details-row :text="eventProgress.text" label="检查事项进度" />
                <details-row
                    v-if="vo.createdAt"
                    :text="parse2RelativeDate(vo.createdAt)"
                    label="创建时间"
                />
                <details-row
                    v-if="vo.updatedAt"
                    :text="parse2RelativeDate(vo.updatedAt)"
                    label="最后修改时间"
                />
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
        padding: 1rem 1rem 0.5rem;
        height: auto;
        border: none;
    }

    > .nue-main {
        height: 100%;
        box-sizing: border-box;
        flex-wrap: nowrap;
        overflow: auto;

        > .nue-content {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
    }

    > .nue-footer {
        padding: 1rem;
        height: auto;
    }

    .nue-div--name-desc {
        flex-direction: column;
        flex-wrap: nowrap;
        align-items: stretch;
        padding: 0.75rem 1rem 1rem;
        width: 100%;
        box-sizing: border-box;
        gap: var(--nue-gap-sm);

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
        align-items: center;
        justify-content: center;
        font-size: var(--nue-text-sm);
        background-color: var(--nue-warning-color-20);
        height: var(--nue-box-size-sm);
        color: var(--nue-warning-color-80);
        width: 100%;
    }

    .tasks-details-view__deleted-tag {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--nue-text-sm);
        background-color: var(--nue-danger-color-30);
        height: var(--nue-box-size-sm);
        color: var(--nue-danger-color-80);
        width: 100%;
    }
}
</style>

