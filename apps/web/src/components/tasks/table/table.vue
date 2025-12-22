<script lang="ts" setup>
import useTaskTable from './use-table'
import { Loading as LoadingComp } from '@nao-todo/components'
import TaskTableHeader from './table-header.vue'
import TaskTableMain from './table-main.vue'
// import TaskTableFooter from './table-footer.vue'
import type { TaskTableProps, TaskTableEmits } from './types'
import './table.css'

defineOptions({ name: 'TaskTable' })
const props = defineProps<TaskTableProps>()
const emit = defineEmits<TaskTableEmits>()

const { loading, error } = useTaskTable(props, emit)
</script>

<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-empty
        v-else-if="error"
        image-size="4rem"
        image-src="/images/coffee.webp"
        description="当前暂无待办"
        style="height: 100%"
    />
    <nue-container v-else id="TodoTableContainer">
        <nue-main>
            <nue-content fill>
                <task-table-header />
                <task-table-main />
            </nue-content>
        </nue-main>
        <!-- <task-table-footer /> -->
    </nue-container>
</template>
