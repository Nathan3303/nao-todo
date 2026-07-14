<script lang="ts" setup>
import TaskListMain from './list-main.vue'
import { Loading as LoadingComp } from '../../loading'
import { useTaskList } from './use-list'
import type { TaskListEmits, TaskListProps } from './types'
import './list.css'

defineOptions({ name: 'TaskList' })
const props = defineProps<TaskListProps>()
const emit = defineEmits<TaskListEmits>()

useTaskList(props, emit)
</script>

<template>
    <nue-container id="TaskListContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    v-if="error || (!loading && tasks.length === 0)"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    style="height: 100%"
                >
                    <nue-text>{{ error || '暂无待办任务' }}</nue-text>
                </nue-empty>
                <nue-infinite-scroll
                    v-else
                    @load-more="emit('nextPage')"
                    :loading="loading"
                    :disabled="disabledNextPage"
                    trigger-height="2px"
                >
                    <task-list-main>
                        <template #actions="{ task }">
                            <slot name="actions" :task="task" />
                        </template>
                    </task-list-main>
                    <template #loading>
                        <loading-comp placeholder="正在加载待办任务..." />
                    </template>
                    <template #disabled>
                        <nue-empty
                            theme="no-image"
                            :description="`${tasks.length} 条待办任务已全部加载完成`"
                        />
                    </template>
                </nue-infinite-scroll>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

