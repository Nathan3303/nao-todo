<template>
    <nue-container id="NaoTodoCalendar" theme="vertical,inner">
        <nue-main class="todo-calendar__main">
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
                        <calendar-todo />
                    </nue-div>
                </div>
            </div>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import CalendarTodo from './todo.vue'
import { useCalendarContent } from './use-content'

const { calendarTodos } = useCalendarContent()
const currentDate = ref(new Date())
const year = computed(() => currentDate.value.getFullYear())
const month = computed(() => currentDate.value.getMonth() + 1)
const weekdays = ['一', '二', '三', '四', '五', '六', '日']

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
</script>

<style scoped>
.todo-calendar__main {
    border: 1px solid var(--divider-color);
    border-radius: var(--primary-radius);
    background-color: var(--divider-color);

    &:deep().nue-main__content {
        padding: 0;
    }

    .todo-calendar__weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        border-bottom: 1px solid var(--divider-color);

        & div {
            text-align: center;
            font-size: var(--text-sm);
            padding: 1rem 0.5rem;
            background: white;
        }
    }

    .todo-calendar__days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        flex: auto;

        .todo-calendar__day {
            background-color: #fafcfe;
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
