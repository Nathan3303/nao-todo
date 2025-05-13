<template>
    <div class="calendar">
        <!-- 日历头部 -->
        <div class="calendar-header">
            <!-- 年份和月份标题 -->
            <div class="calendar-title">{{ year }}年 {{ month }}月</div>
            <!-- 年月调整栏 -->
            <div class="calendar-controls">
                <button @click="prevMonth">上一月</button>
                <button @click="nextMonth">下一月</button>
            </div>
        </div>
        <!-- 日历主体 -->
        <div class="calendar-body">
            <!-- 星期表头 -->
            <div class="calendar-weekdays">
                <div v-for="day in weekdays" :key="day">{{ day }}</div>
            </div>
            <!-- 日期宫格 -->
            <div class="calendar-days">
                <div v-for="(day, index) in days" :key="index" class="calendar-day">
                    <div class="day-number">{{ day.day }}</div>
                    <!-- 任务展示 -->
                    <div
                        v-for="task in getTasksForDay(day)"
                        :key="task.id"
                        :class="['task', { 'multi-day-task': task.endDate }]"
                        :style="{ gridColumn: getGridColumnSpan(task, day), zIndex: task.zIndex }"
                    >
                        {{ task.title }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'

// 初始化日期
const currentDate = ref(new Date())
const year = computed(() => currentDate.value.getFullYear())
const month = computed(() => currentDate.value.getMonth() + 1)

// 星期表头
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

// 获取当前月的天数
const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate()
}

// 获取当前月的第一天是星期几
const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay()
}

// 生成当前月的日期数组
const days = computed(() => {
    const firstDay = getFirstDayOfMonth(year.value, month.value)
    const daysInMonth = getDaysInMonth(year.value, month.value)
    const daysArray = []

    // 填充前面的空白
    for (let i = 0; i < firstDay; i++) {
        daysArray.push({ day: null })
    }

    // 填充当前月的日期
    for (let i = 1; i <= daysInMonth; i++) {
        daysArray.push({ day: i })
    }

    return daysArray
})

// 切换月份
const prevMonth = () => {
    currentDate.value = new Date(year.value, month.value - 2, 1)
}

const nextMonth = () => {
    currentDate.value = new Date(year.value, month.value, 1)
}

// 模拟任务数据，添加 endDate 字段表示任务结束日期
const tasks = ref([
    { id: 1, startDate: '2025-03-05', endDate: '2025-03-07', title: '任务1' },
    { id: 2, startDate: '2025-03-10', endDate: null, title: '任务2' },
    { id: 3, startDate: '2025-03-10', endDate: '2025-03-12', title: '任务3' },
    { id: 4, startDate: '2025-03-05', endDate: '2025-03-10', title: '任务4' }
])

// 获取指定日期的任务
const getTasksForDay = (day: { day: number | null }) => {
    if (!day.day) return []
    const date = `${year.value}-${month.value.toString().padStart(2, '0')}-${day.day.toString().padStart(2, '0')}`
    const tasksForDay = tasks.value.filter((task) => {
        if (task.endDate) {
            return date >= task.startDate && date <= task.endDate
        }
        return task.startDate === date
    })
    // 按任务 ID 排序，确保顺序展示
    return tasksForDay
        .sort((a, b) => a.id - b.id)
        .map((task, index) => ({
            ...task,
            // 为每个任务添加层级信息
            zIndex: index + 1
        }))
}

// 计算多日任务的列跨度
const getGridColumnSpan = (task: any, day: { day: number | null }) => {
    if (!task.endDate || !day.day) return '1'
    const startDay = new Date(task.startDate).getDate()
    const endDay = new Date(task.endDate).getDate()
    const currentDay = day.day
    if (currentDay === startDay) {
        return `${endDay - startDay + 1}`
    }
    if (currentDay > startDay && currentDay <= endDay) {
        return '0' // 中间日期不占用列
    }
    return '1'
}
</script>

<style scoped>
/* 已有样式保持不变 */
.calendar {
    margin: 0 auto;
    padding: 20px;
    background-color: #f9fafb;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    width: 100%;
}
.calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 10px 15px;
    background-color: #e5f6ff;
    border-radius: 4px;
}
.calendar-title {
    font-size: 20px;
    font-weight: 600;
    color: #333;
}
.calendar-controls {
    display: flex;
    gap: 10px;
}
.calendar-controls button {
    padding: 6px 12px;
    background-color: #d3e8ff;
    border: none;
    border-radius: 4px;
    color: #333;
    cursor: pointer;
    transition: background-color 0.3s ease;
}
.calendar-controls button:hover {
    background-color: #b3d7ff;
}
.calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
    margin-bottom: 10px;
    background-color: #f1f5f9;
    padding: 8px 10px;
    border-radius: 4px;
}
.calendar-weekdays div {
    text-align: center;
    color: #666;
    font-size: 14px;
}
.calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0;
}
.calendar-day {
    background-color: #fff;
    padding: 8px;
    min-height: 100px;
    border-radius: 0;
    transition: background-color 0.3s ease;
    position: relative;
}
.calendar-day:hover {
    background-color: #f9fafb;
}
.day-number {
    font-weight: 600;
    margin-bottom: 3px;
    color: #333;
    font-size: 16px;
}
.task {
    background-color: #f3f4f6;
    padding: 3px 5px;
    margin-bottom: 2px;
    border-radius: 0;
    color: #666;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 2; /* 确保任务显示在多日任务之上 */
}
.multi-day-task {
    grid-column: span 1;
    background-color: #d3e8ff;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1; /* 多日任务层级低于普通任务 */
    display: flex;
    align-items: center;
    height: 1.2em;
    line-height: 1.2em;
    white-space: nowrap;
    overflow: visible;
    text-overflow: clip;
}
</style>
