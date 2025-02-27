import { defineStore } from 'pinia'
import { computed } from 'vue'

type AfterResizePayload = {
    oldWidth: number
    newWidth: number
}

export const useTasksLayoutStore = defineStore('TasksLayoutStore', () => {
    const asideWidth = computed(() => {
        const width = localStorage.getItem('tasks/layoutInfo/asideWidth')
        return width ?? '250px'
    })

    const outlineWidth = computed(() => {
        const width = localStorage.getItem('tasks/layoutInfo/outlineWidth')
        return width ?? '36%'
    })

    const handleAfterAsideResize = (payload: AfterResizePayload) => {
        localStorage.setItem(
            'tasks/layoutInfo/asideWidth',
            payload.newWidth + 'px'
        )
    }

    const handleAfterOutlineResize = (payload: AfterResizePayload) => {
        localStorage.setItem(
            'tasks/layoutInfo/outlineWidth',
            payload.newWidth + 'px'
        )
    }

    return {
        asideWidth,
        outlineWidth,
        handleAfterAsideResize,
        handleAfterOutlineResize
    }
})
