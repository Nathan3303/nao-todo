<template>
    <nue-container id="CalendarController" theme="vertical,inner">
        <nue-header class="calender-controller__header">
            <template #logo>
                <nue-text>{{ year }} 年 {{ month }} 月</nue-text>
            </template>
            <template #actions>
                <nue-div gap=".5rem">
                    <nue-button icon="arrow-left" theme="icon-only,small" @click="prevMonth" />
                    <nue-button icon="arrow-right" theme="icon-only,small" @click="nextMonth" />
                </nue-div>
            </template>
        </nue-header>
        <nue-main class="calendar-controller__main">
            <div class="calendar-controller__weekdays">
                <div v-for="day in weekdays" :key="day">{{ day }}</div>
            </div>
            <div class="calendar-controller__days">
                <div
                    v-for="(day, index) in days"
                    :key="index"
                    class="calendar-controller__day"
                    :data-is-current-month="day.isCurrentMonth"
                    :data-month-begin="day.isCurrentMonth && day.day === 1"
                    :data-month-end="day.isCurrentMonth && day.day === getDaysInMonth(year, month)"
                    :data-selected="false"
                >
                    <div class="calendar-controller__day__number">
                        <span>{{ day.day }}</span>
                    </div>
                    <div class="calendar-controller__day__bar" v-if="false"></div>
                </div>
            </div>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 初始化日期
const currentDate = ref(new Date())
const year = computed(() => currentDate.value.getFullYear())
const month = computed(() => currentDate.value.getMonth() + 1)

// 星期表头
const weekdays = ['一', '二', '三', '四', '五', '六', '日']

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
    const daysInLastMonth = getDaysInMonth(year.value, month.value - 1)
    const daysInMonth = getDaysInMonth(year.value, month.value)
    const daysArrayLength = 42
    const daysArray: { day: number; isCurrentMonth: boolean }[] = Array.from(
        { length: daysArrayLength },
        () => ({ day: 0, isCurrentMonth: true })
    )
    const startAt = (firstDay + 6) % 7
    const endAt = daysInMonth + startAt
    for (let i = startAt, j = 1; i < endAt; i++, j++) {
        daysArray[i] = { day: j, isCurrentMonth: true }
    }
    for (let i = startAt - 1, j = daysInLastMonth; i >= 0; i--, j--) {
        daysArray[i] = { day: j, isCurrentMonth: false }
    }
    for (let i = endAt, j = 1; i < daysArrayLength; i++, j++) {
        daysArray[i] = { day: j, isCurrentMonth: false }
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
</script>

<style scoped>
.calender-controller__header {
    height: 2.5rem;
    padding: 0;

    &:deep().nue-header__logo {
        padding: 0 0.5rem;
    }

    &:deep().nue-header__actions {
        margin-left: auto;
        padding: 0 0.25rem;
    }
}

.calendar-controller__main {
    border: none !important;

    &:deep().nue-main__content {
        padding: 0;
    }

    .calendar-controller__weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        border-radius: var(--primary-radius);
        gap: 0.25rem;

        & div {
            text-align: center;
            color: var(--primary-color-500);
            font-size: var(--text-sm);
            padding: 0.5rem;
        }
    }

    .calendar-controller__days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.25rem;

        .calendar-controller__day {
            --height: 0.5rem;

            background-color: #fff;
            border-radius: 0;
            transition: background-color 0.16s ease-out;
            position: relative;
            padding: var(--height) 0.5rem;
            text-align: center;
            border-radius: var(--primary-radius);
            font-size: var(--text-sm);
            cursor: default;

            &:hover {
                cursor: pointer;
                background-color: rgb(255, 196, 86);
                color: var(--primary-color-900) !important;
            }

            &[data-month-begin='true']::before {
                content: '';
                position: absolute;
                top: calc(var(--height) - 0.25rem);
                left: calc(50% - 0.125rem);
                width: 0.25rem;
                height: 0.25rem;
                border-radius: 50%;
                background-color: var(--primary-color-a100);
                z-index: 1;
            }

            &[data-month-end='true']::after {
                content: '';
                position: absolute;
                top: calc(var(--height) - 0.25rem);
                right: calc(50% - 0.125rem);
                width: 0.25rem;
                height: 0.25rem;
                border-radius: 50%;
                background-color: var(--primary-color-a100);
                z-index: 1;
            }

            .calendar-controller__day__bar {
                position: absolute;
                width: auto;
                min-width: 0.5rem;
                height: 0.125rem;
                background-color: #ffffff;
                bottom: calc(var(--height) - 0.125rem);
                left: calc(50% - 0.25rem);
                border-radius: 0.125rem;
            }

            &[data-is-current-month='false'] {
                color: var(--primary-color-600);
            }

            &[data-selected='true'] {
                cursor: pointer;
                background-color: orange;
                font-weight: bolder;
            }
        }
    }
}
</style>
