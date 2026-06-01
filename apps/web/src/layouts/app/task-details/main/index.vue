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
import { t } from '@nao-todo/infrastructure/locales'

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
        <!-- 任务详情头部 -->
        <nue-header>
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
                    :active-text="t('task.details.unfavorite')"
                    icon="heart"
                    size="small"
                    :text="t('task.details.favorite')"
                    @change="updateTaskIsStarMark"
                />
            </nue-div>
            <nue-div class="tasks-details-view__progress">
                <nue-progress :percentage="eventProgress.percentage" :stroke-width="2" hide-text />
            </nue-div>
        </nue-header>
        <!-- 任务详情主体 -->
        <nue-main>
            <nue-content fill>
                <!-- 任务详情名称和描述 -->
                <nue-div theme="name-desc">
                    <nue-textarea
                        v-model="vo.name"
                        :autosize="{ minRows: 1, maxRows: 2 }"
                        maxlength="64"
                        :placeholder="t('task.details.namePlaceholder')"
                        theme="pure,name"
                        @change="updateTaskName"
                    />
                    <nue-textarea
                        v-model="vo.description"
                        :autosize="{ minRows: 1, maxRows: 99 }"
                        maxlength="256"
                        :placeholder="t('task.details.descPlaceholder')"
                        theme="pure,description"
                        @change="updateTaskDescription"
                    />
                </nue-div>
                <!-- 任务详情事件 -->
                <nue-div vertical style="padding: 0 1rem">
                    <details-main-events />
                </nue-div>
                <nue-div flex="1"></nue-div>
                <!-- 任务详情标签 -->
                <nue-div vertical style="padding: 1rem">
                    <task-tag-bar :tags="tags" :task-tags="vo.tags" @update-tags="updateTaskTags" />
                </nue-div>
                <!-- 任务详情评论 -->
                <details-main-comments />
                <!-- 任务详情删除标签 -->
                <nue-div class="tasks-details-view__deleted-tag" v-if="vo.isDeleted">
                    {{
                        t('task.details.deletedAt', {
                            date: parse2RelativeDate(vo.deletedAt!) ?? ''
                        })
                    }}
                </nue-div>
                <!-- 任务详情放弃标签 -->
                <nue-div class="tasks-details-view__giveup-tag" v-if="vo.isGivenUp">
                    {{
                        t('task.details.givenUpAt', {
                            date: parse2RelativeDate(vo.givenUpAt!) ?? ''
                        })
                    }}
                </nue-div>
            </nue-content>
        </nue-main>
        <!-- 任务详情底部 -->
        <nue-footer>
            <!-- 任务详情评论创建器 -->
            <nue-div v-if="isCommenting" vertical width="100%">
                <comment-creator :handler="createCommentHandler" @cancel="isCommenting = false" />
            </nue-div>
            <!-- 任务详情事件进度 -->
            <nue-div justify="space-between" width="100%" overflow="auto">
                <details-row :text="eventProgress.text" :label="t('task.details.eventProgress')" />
                <details-row
                    v-if="vo.createdAt"
                    :text="parse2RelativeDate(vo.createdAt)"
                    :label="t('task.details.createdAt')"
                />
                <details-row
                    v-if="vo.updatedAt"
                    :text="parse2RelativeDate(vo.updatedAt)"
                    :label="t('task.details.updatedAt')"
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
        background-color: var(--nue-error-color-30);
        height: var(--nue-box-size-sm);
        color: var(--nue-error-color-80);
        width: 100%;
    }
}
</style>

