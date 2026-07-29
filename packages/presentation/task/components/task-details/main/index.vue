<script setup lang="ts">
import {
    CommentCreator,
    parse2RelativeDate,
    t,
    TAG_CREATOR_DIALOG_KEY,
    TaskSelector
} from '@nao-todo/shared'
import { TaskTagBar } from '../../tag-bar'
import { inject } from 'vue'
import { TaskPrioritySelectOptions, TaskStateSelectOptions } from '@nao-todo/domain-task'
import type { TaskViewObject } from '@nao-todo/application'
import { TASK_DETAILS_CONTEXT_KEY } from '../context.js'
import DetailsMainComments from './comments.vue'
import DetailsMainEvents from './events.vue'
import DetailsMainPomodoroInfo from './pomodoro-info.vue'
import DetailsRow from './row.vue'
import DetailsMainSubTasks from './subtasks.vue'

const {
    vo,
    checkItemProgress,
    subTaskProgress,
    isCommenting,
    commentHandler,
    tags,
    dialogManager,
    switchTaskDetails,
    updateTaskDetails
} = inject(TASK_DETAILS_CONTEXT_KEY)!

const backToParent = () => {
    if (!vo.value?.parentTaskId) return
    switchTaskDetails(vo.value.parentTaskId)
}

const updateTaskState = (v: unknown) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { state: v as TaskViewObject['state'] })
}

const updateTaskPriority = (v: unknown) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { priority: v as TaskViewObject['priority'] })
}

const updateTaskName = () => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { name: vo.value.name as TaskViewObject['name'] })
}

const updateTaskDescription = () => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, {
        description: vo.value.description as TaskViewObject['description']
    })
}

const updateTaskTags = (v: unknown) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { tags: v as TaskViewObject['tags'] })
}

const createCommentHandler = async (content: string) => {
    if (vo.value === null) return false
    const createError = await commentHandler.create({ taskId: vo.value.id, content })
    return createError === null
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
                <details-main-pomodoro-info :task-details="vo" />
                <!-- <switch-button
                    v-model="vo.isStarMarked"
                    active-icon="heart-fill"
                    :active-text="t('task.details.unfavorite')"
                    icon="heart"
                    size="small"
                    :text="t('task.details.favorite')"
                    @change="updateTaskIsStarMark"
                /> -->
            </nue-div>
            <nue-div class="tasks-details-view__progress">
                <nue-progress
                    :percentage="checkItemProgress.percentage"
                    :stroke-width="2"
                    hide-text
                />
            </nue-div>
        </nue-header>
        <!-- 任务详情主体 -->
        <nue-main>
            <nue-content fill>
                <!-- 任务详情名称和描述 -->
                <nue-div theme="name-desc">
                    <nue-button
                        v-if="vo.parentTaskId"
                        icon="arrow-left-more"
                        theme="pure"
                        :title="t('task.details.backToParent')"
                        @click="backToParent"
                    >
                        {{ t('task.details.backToParent') }}
                    </nue-button>
                    <nue-textarea
                        v-model="vo.name"
                        :autosize="{ minRows: 1, maxRows: 2 }"
                        maxlength="64"
                        :placeholder="t('task.details.namePlaceholder')"
                        theme="pure,name"
                        @change="updateTaskName"
                    />
                    <nue-textarea
                        v-model="vo.description as string | undefined"
                        :autosize="{ minRows: 1, maxRows: 99 }"
                        maxlength="256"
                        :placeholder="t('task.details.descPlaceholder')"
                        theme="pure,description"
                        @change="updateTaskDescription"
                    />
                </nue-div>
                <!-- 任务详情事件 -->
                <nue-div vertical style="padding: 0 1rem 1rem; margin-bottom: auto">
                    <details-main-events />
                </nue-div>
                <!-- 任务详情标签 -->
                <nue-div vertical style="padding: 1rem">
                    <task-tag-bar
                        :available-tags="tags"
                        :task-tag-ids="vo.tags"
                        @update-tags="updateTaskTags"
                        @create-tag="
                            (name: string) => dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })
                        "
                    />
                </nue-div>
                <!-- 任务详情子任务 -->
                <details-main-sub-tasks />
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
            <nue-div justify="space-between" width="100%" overflow="auto" wrap="nowrap">
                <details-row
                    :text="checkItemProgress.text"
                    :label="t('task.details.eventProgress')"
                />
                <details-row
                    :text="subTaskProgress.text"
                    :label="t('task.details.subTaskProgress')"
                />
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

        .nue-button--pure {
            font-size: var(--nue-text-xs);
            color: var(--nue-primary-color-500);
            line-height: 1;
            gap: var(--nue-gap-2xs);
            width: fit-content;

            &:hover {
                color: var(--nue-primary-color-800);
                text-decoration: underline;
            }
        }

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
