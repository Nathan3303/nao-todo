<script setup lang="ts">
import { inject } from 'vue'
import { TaskStateInfo } from '@nao-todo/shared/components/task-state-info'
import { TaskPriorityInfo } from '@nao-todo/shared/components/task-priority-info'
import { TaskDateInfo } from '@nao-todo/shared/components/task-date-info'
import { TaskBasicInfo } from '@nao-todo/shared/components/task-basic-info'
import { t } from '@nao-todo/shared/locales'
import { TaskTagBar } from '../../'
import { TASK_LIST_CONTEXT_KEY } from './use-list'
import type { TaskListContext } from './types'

defineOptions({ name: 'TaskListMain' })

const {
    tasks,
    tags,
    columns,
    tagBarClamped,
    small,
    refreshKey,
    isInMultiSelectRange,
    getProjectName,
    showMultiSelectPanel,
    deleteOrRestore,
    handleClickTask
} = inject<TaskListContext>(TASK_LIST_CONTEXT_KEY)!
</script>

<template>
    <nue-div theme="todo-list-main">
        <nue-div
            v-for="(task, idx) in tasks"
            theme="todo-list-main__row"
            :class="{ 'todo-list-main__row--small': small }"
            :key="`${task.id}.${refreshKey}`"
            :data-done="task.state === 'done'"
            :data-archived="task.isArchived ? 'true' : 'false'"
            :data-selected="isInMultiSelectRange(idx)"
            :data-deleted="task.isDeleted"
            @click.stop.exact="handleClickTask(task, idx)"
            @click.stop.shift.exact="showMultiSelectPanel(idx)"
            @mousedown="(event: MouseEvent) => event.shiftKey && event.preventDefault()"
        >
            <nue-div theme="todo-list-main__row__first">
                <nue-div theme="todo-list__main__row__first__name-wrapper">
                    <nue-div class="list-name-cell">
                        <nue-text :clamped="1" :title="task.name">{{ task.name }}</nue-text>
                        <!-- 已归档标记（`T795`）：图标 + 文字（灰阶 + 本标记 + `data-archived` 三重冗余） -->
                        <span
                            v-if="task.isArchived"
                            class="list-name-cell__archived"
                            data-archived-mark
                        >
                            {{ t('task.details.archivedBadge') }}
                        </span>
                        <!-- 星标 -->
                        <nue-icon
                            v-if="task.isStarMarked"
                            class="list-name-cell__star"
                            name="heart-fill"
                        />
                    </nue-div>
                    <task-tag-bar
                        v-if="columns.tags && task.tags.length"
                        :clamped="tagBarClamped"
                        :available-tags="tags"
                        :task-tag-ids="task.tags"
                        readonly
                        small
                    />
                    <nue-divider vertical />
                    <nue-div theme="todo-list-main__row__actions">
                        <slot name="actions" :task="task">
                            <nue-button
                                :icon="task.isDeleted ? 'restore' : 'delete'"
                                theme="icon,ghost,pure"
                                @click.stop="deleteOrRestore(task.id, task.isDeleted)"
                            />
                        </slot>
                    </nue-div>
                </nue-div>
                <nue-text
                    v-if="columns.description && task.description"
                    :clamped="3"
                    :title="task.description"
                    theme="description"
                >
                    {{ task.description }}
                </nue-text>
            </nue-div>
            <nue-div
                v-if="
                    columns?.createdAt ||
                    columns?.updatedAt ||
                    columns?.endAt ||
                    columns?.state ||
                    columns?.priority ||
                    columns?.project
                "
                theme="todo-list-main__row__attrs"
            >
                <task-date-info
                    v-if="columns.createdAt"
                    :date="task.createdAt"
                    :formatter="(date) => `创建于${date}`"
                />
                <task-date-info
                    v-if="columns?.updatedAt"
                    :date="task.updatedAt"
                    :formatter="(date) => `更新于${date}`"
                />
                <task-date-info
                    v-if="columns?.endAt"
                    :date="task.endAt!"
                    :formatter="(date) => `结束于${date}`"
                    :colored="!(task.state === 'done')"
                />
                <task-state-info v-if="columns?.state" :state="task.state" />
                <task-priority-info v-if="columns?.priority" :priority="task.priority" />
                <task-basic-info
                    v-if="columns?.project"
                    icon="inbox-fill"
                    :text="'清单：' + (getProjectName(task.projectId || '') || '收集箱')"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
/* 已归档（`T795`）：行去强调色（灰阶）+ 名称旁文字标记；正文 token 为中性灰 ⇒ 对比不变（≥4.5:1） */
.nue-div--todo-list-main__row[data-archived='true'] {
    filter: grayscale(1);
}

.list-name-cell__archived {
    flex: none;
    margin-left: var(--nue-gap-2xs);
    padding: 0 var(--nue-padding-2xs);
    border-radius: var(--nue-radius-sm);
    font-size: var(--nue-text-2xs);
    line-height: 1.6;
    color: var(--nue-primary-color-700);
    background-color: var(--nue-primary-color-200);
    white-space: nowrap;
}
</style>