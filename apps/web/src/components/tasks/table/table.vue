<script lang="ts" setup>
import useTaskTable from './use-table'
import { Loading as LoadingComp } from '@nao-todo/components'
import TaskTableHeader from './table-header.vue'
import TaskTableMain from './table-main.vue'
import type { TaskTableProps, TaskTableEmits } from './types'
import './table.css'

defineOptions({ name: 'TaskTable' })
const props = defineProps<TaskTableProps>()
const emit = defineEmits<TaskTableEmits>()

useTaskTable(props, emit)
</script>

<template>
    <nue-container id="TodoTableContainer">
        <nue-main>
            <nue-content fill>
                <task-table-header />
                <loading-comp height="auto" v-if="loading" />
                <nue-empty
                    v-else-if="!loading && !tasks.length"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    description="当前暂无待办"
                    style="flex: auto"
                />
                <task-table-main v-else />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

