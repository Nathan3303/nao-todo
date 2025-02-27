<!-- <template>
    <nue-div align="center" height="100%" justify="center">
        <nue-empty description="日历视图筹备中" />
    </nue-div>
</template>

<script lang="ts" setup></script>

<style scoped></style> -->

<template>
    <div class="calenda-view">
        <Sidebar
            @dateRangeChange="updateDateRange"
            @taskStatusChange="updateTaskStatus"
            @taskTypeChange="updateTaskType"
        />
        <Calendar
            :dateRange="selectedDateRange"
            :taskStatus="selectedTaskStatus"
            :taskType="selectedTaskType"
            @taskClick="openTaskDetails"
        />
        <TaskList
            :tasks="filteredTasks"
            @createNewTask="createNewTask"
            @editTask="editTask"
            @deleteTask="deleteTask"
        />
    </div>
</template>

<script>
import Sidebar from './Sidebar.vue'
import Calendar from './Calendar.vue'
import TaskList from './TaskList.vue'

export default {
    components: {
        Sidebar,
        Calendar,
        TaskList
    },
    data() {
        return {
            selectedDateRange: 'month',
            selectedTaskStatus: 'all',
            selectedTaskType: 'all',
            tasks: [
                // 示例任务数据
                { title: '任务1', status: '未完成', type: '类型1' },
                { title: '任务2', status: '已完成', type: '类型2' }
            ]
        }
    },
    computed: {
        filteredTasks() {
            return this.tasks.filter(
                (task) =>
                    task.status === this.selectedTaskStatus &&
                    (this.selectedTaskType === 'all' ||
                        task.type === this.selectedTaskType)
            )
        }
    },
    methods: {
        updateDateRange(range) {
            this.selectedDateRange = range
        },
        updateTaskStatus(status) {
            this.selectedTaskStatus = status
        },
        updateTaskType(type) {
            this.selectedTaskType = type
        },
        openTaskDetails(task) {
            // 打开任务详细信息的逻辑
        },
        createNewTask() {
            // 创建新任务的逻辑
        },
        editTask(task) {
            // 编辑任务的逻辑
        },
        deleteTask(task) {
            // 删除任务的逻辑
        }
    }
}
</script>

<style scoped>
.app {
    display: flex;
}
.sidebar,
.task-list {
    padding: 20px;
    width: 300px;
    border-right: 1px solid #ddd;
}
</style>
