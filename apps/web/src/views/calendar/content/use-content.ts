import {  computed } from 'vue'
import { useTodoStore } from '@/stores'

const useCalendarContent = () => {
    const todoStore = useTodoStore()
    todoStore.updateGetOptions({
        isDeleted: false,
        isArchived: false,
        isGivenUp: false,
        relativeDate: 'month'
    })
    todoStore.doGetTodos()

    const calendarTodos = computed(() => todoStore.todos)

    return { calendarTodos }
}

export { useCalendarContent }
