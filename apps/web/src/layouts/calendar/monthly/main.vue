<template>
    <nue-div theme="monthly-main" vertical>
        <div class="todo-calendar__weekdays">
            <div v-for="day in weekdays" :key="day">{{ day }}</div>
        </div>
        <div class="todo-calendar__days">
            <div
                v-for="(day, index) in days"
                :key="index"
                class="todo-calendar__day"
                :data-is-current-month="day.isCurrentMonth"
                :data-selected="false"
            >
                <div class="todo-calendar__day__number">
                    {{ day.day }}
                </div>
                <nue-div class="calendar__day__todos">
                    <calendar-todo v-if="hasTodo(day.day, day.isCurrentMonth)" />
                </nue-div>
            </div>
        </div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import CalendarTodo from './todo.vue'
import { t } from '@nao-todo/infrastructure/locales'

const currentDate = ref(new Date())
const year = computed(() => currentDate.value.getFullYear())
const month = computed(() => currentDate.value.getMonth() + 1)
const weekdays = computed(() => [
    t('calendar.weekday.mon'), t('calendar.weekday.tue'), t('calendar.weekday.wed'),
    t('calendar.weekday.thu'), t('calendar.weekday.fri'), t('calendar.weekday.sat'),
    t('calendar.weekday.sun')
])

const days = computed(() => {
    const firstDay = new Date(year.value, month.value - 1, 1).getDay()
    const daysInLastMonth = new Date(year.value, month.value - 1, 0).getDate()
    const daysInMonth = new Date(year.value, month.value, 0).getDate()
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

const hasTodo = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return false
    return [5, 12, 15, 20, 28].includes(day)
}
</script>

<style scoped>
.nue-div--monthly-main {
    width: 100%;
    height: 100%;
    border-radius: var(--nue-primary-radius);
    background-color: var(--nue-divider-color);

    .todo-calendar__weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        border-bottom: 1px solid var(--nue-divider-color);

        & div {
            text-align: center;
            font-size: var(--text-sm);
            padding: 1rem 0.5rem;
            background: var(--nue-primary-color-0);
        }
    }

    .todo-calendar__days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        flex: auto;

        .todo-calendar__day {
            background-color: var(--nue-primary-color-0);
            text-align: center;
            font-size: var(--text-sm);
            cursor: default;
            padding: 0.5rem 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;

            .todo-calendar__day__number {
                display: flex;
                width: 1.5rem;
                height: 1.5rem;
                justify-content: center;
                align-items: center;
                border-radius: 50%;
                font-weight: 500;
                /* background-color: var(--primary-color-300); */
            }

            &[data-is-current-month='false'] {
                color: var(--nue-primary-color-600);
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

