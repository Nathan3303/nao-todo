<template>
    <div class="task-list">
        <h3>今日任务</h3>
        <ul>
            <li
                v-for="(task, index) in tasks"
                :key="index"
                @click="openTaskDetails(task)"
            >
                {{ task.title }} - {{ task.status }}
            </li>
        </ul>
        <button @click="createNewTask">创建新任务</button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            tasks: [
                // 示例任务数据
                { title: '任务1', status: '未完成', type: '类型1' },
                { title: '任务2', status: '已完成', type: '类型2' }
            ]
        }
    },
    methods: {
        openTaskDetails(task) {
            // 打开任务详细信息的逻辑
        },
        createNewTask() {
            // 创建新任务的逻辑
        }
    }
}
</script>

<style scoped>
.task-list {
    width: 300px;
    padding: 20px;
}
ul {
    list-style-type: none;
    padding: 0;
}
li {
    cursor: pointer;
    padding: 10px;
    border-bottom: 1px solid #ddd;
    transition: background-color 0.3s;
}
li.completed {
    text-decoration: line-through;
    color: #888;
}
button {
    margin-top: 10px;
}
</style>
