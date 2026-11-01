<script lang="ts" setup>
import { Loading as LoadingComponent } from '@nao-todo/shared/components/loading'
import { TaskPriorityInfo } from '@nao-todo/shared/components/task-priority-info'
import { TaskStateInfo } from '@nao-todo/shared/components/task-state-info'
import { t } from '@nao-todo/shared/locales'
import { NueInfiniteScroll } from 'nue-ui'
import { inject } from 'vue'
import TaskKanbanColumnItem from './kanban-column-item.vue'
import type { TaskKanbanColumnProps, TaskKanbanContext } from './types'
import { TASK_KANBAN_CONTEXT_KEY } from './use-kanban'
import useKanbanColumn from './use-kanban-column'

defineOptions({ name: 'TodoKanbanColumn' })
const props = defineProps<TaskKanbanColumnProps>()

const context = inject<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY)!
const { refreshKey, tags, updatingTaskIds } = context
const { columnTasks, total, isDone, loadingFirst, loadingMore, error, loadMore } = useKanbanColumn(
    props,
    context
)
</script>

<template>
    <nue-container class="kanban-column" :class="{ 'kanban-column--disabled': disabled }">
        <nue-header class="kanban-column__header">
            <!-- 列头随分组方式切换：state ⇒ 状态名；priority ⇒ 优先级档位（PRD AC1b） -->
            <task-state-info v-if="groupBy === 'state'" :state="category" />
            <task-priority-info v-else :priority="category" />
            <!-- 列头数字 = 该列**总数**（不是已加载数 —— PRD R-D / AC3） -->
            <nue-text color="var(--nue-primary-color-600)" size="var(--nue-text-xs)">
                {{ total }}
            </nue-text>
        </nue-header>
        <!-- 到底判据由列内 `page * limit >= total` 决定（R-K）；loading 只驱动列底加载条 -->
        <nue-infinite-scroll
            :loading="loadingMore"
            :disabled="isDone"
            trigger-height="2px"
            @load-more="loadMore"
        >
            <template #disabled>
                <!-- R-L：`#disabled` 槽渲染「没有更多了」（DOM 可见，不再被 CSS 隐藏） -->
                <nue-text color="var(--nue-disabled-color)" size="var(--nue-text-xs)">
                    {{ t('task.kanban.noMore') }}
                </nue-text>
            </template>
            <nue-main class="kanban-column__main">
                <nue-content fill style="overflow: hidden">
                    <!-- 首屏 loading 才整列占位（R-K：触底加载不得替换整列） -->
                    <loading-component v-if="loadingFirst" placeholder="正在加载任务" />
                    <nue-empty v-else-if="error" theme="no-image" :description="error" />
                    <nue-empty
                        v-else-if="columnTasks.length === 0"
                        theme="no-image"
                        :description="t('task.noTasksInColumn')"
                    />
                    <task-kanban-column-item
                        v-else
                        v-for="task in columnTasks"
                        :key="`${task.id}.${refreshKey}`"
                        :actived="task.id === $route.params.taskId"
                        :columns="columns"
                        :data-taskId="task.id"
                        :data-todoId="task.id"
                        :task="task"
                        :tags="tags"
                        :is-updating="updatingTaskIds.has(task.id)"
                        :draggable="!updatingTaskIds.has(task.id)"
                    />
                </nue-content>
            </nue-main>
        </nue-infinite-scroll>
    </nue-container>
</template>