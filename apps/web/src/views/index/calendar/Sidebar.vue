<template>
    <div class="sidebar">
        <h3>筛选</h3>
        <div>
            <label for="dateRange">日期范围:</label>
            <select v-model="selectedDateRange" @change="updateDateRange">
                <option value="month">一个月</option>
                <option value="week">一周</option>
                <option value="year">一年</option>
            </select>
        </div>
        <div>
            <label for="taskStatus">任务状态:</label>
            <select v-model="selectedTaskStatus" @change="updateTaskStatus">
                <option value="all">全部</option>
                <option value="pending">未完成</option>
                <option value="completed">已完成</option>
            </select>
        </div>
        <div>
            <label for="taskType">任务类型:</label>
            <select v-model="selectedTaskType" @change="updateTaskType">
                <option value="all">全部</option>
                <option value="type1">类型1</option>
                <option value="type2">类型2</option>
                <!-- 可根据需要添加更多任务类型 -->
            </select>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            selectedDateRange: 'month',
            selectedTaskStatus: 'all',
            selectedTaskType: 'all'
        }
    },
    methods: {
        updateDateRange() {
            // 更新日期范围的逻辑
        },
        updateTaskStatus() {
            // 更新任务状态的逻辑
        },
        updateTaskType() {
            // 更新任务类型的逻辑
        }
    }
}
</script>

<style scoped>
.sidebar {
    background-color: #f4f4f4;
    padding: 20px;
    width: 300px;
    border-right: 1px solid #ddd;
}
.filter-item {
    margin-bottom: 10px;
}
label,
select {
    display: block;
    font-size: 16px;
}
select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
}
</style>
