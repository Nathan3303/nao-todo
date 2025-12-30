<script lang="ts" setup>
import { useTaskList } from './use-list'
import TaskListMain from './list-main.vue'
import { Loading as LoadingComp } from '@nao-todo/components'
import type { TaskListEmits, TaskListProps } from './types'
import { onMounted } from 'vue'
import './list.css'

defineOptions({ name: 'TaskList' })
const props = defineProps<TaskListProps>()
const emit = defineEmits<TaskListEmits>()

const { states, fetchTasks, loadMore } = useTaskList(props, emit)

onMounted(() => {
    states.isDone = true
    fetchTasks().then(() => {
        states.isDone = false
    })  
})
</script>

<template>
    <nue-container id="TaskListContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    v-if="states.error && tasks.length === 0"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    :description="states.error"
                    style="height: 100%"
                />
                <nue-infinite-scroll
                    v-else
                    @load-more="loadMore"
                    :loading="states.loading"
                    :disabled="states.isDone"
                    trigger-height="2px"
                >
                    <task-list-main />
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
