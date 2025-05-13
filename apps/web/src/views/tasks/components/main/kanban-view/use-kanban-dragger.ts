import { ref } from 'vue'
import { useTodoStore } from '@/stores'
import type { Todo } from '@nao-todo/types'

export const useKanbanDragger = () => {
    const todoStore = useTodoStore()
    const draggingTodoId = ref<Todo['id']>('')

    const handleRemoveDragOverClass = () => {
        document.querySelectorAll('.kanban-column__main--drag-over').forEach((element) => {
            element.classList.remove('kanban-column__main--drag-over')
        })
    }

    const getDropNode = (node: HTMLElement) => {
        while (node) {
            if (node.dataset.droppable === 'true') {
                return node
            }
            if (node.parentNode) {
                node = node.parentNode as HTMLElement
            }
        }
    }

    const getTargetNode = (node: HTMLElement) => {
        while (node) {
            if (node.dataset.category) {
                return node
            }
            if (node.parentNode) {
                node = node.parentNode as HTMLElement
            }
        }
    }

    const handleDragStart = (event: DragEvent) => {
        const target = event.target as HTMLElement
        draggingTodoId.value = target.dataset.todoid as string
    }

    const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
        event.dataTransfer!.dropEffect = 'move'
    }

    const handleDragEnter = (event: DragEvent) => {
        event.preventDefault()
        handleRemoveDragOverClass()
        const element = getDropNode(event.target as HTMLElement)
        if (element && element.dataset.droppable === 'true') {
            element.classList.add('kanban-column__main--drag-over')
        }
    }

    const handleDragEnd = () => handleRemoveDragOverClass()

    const handleDrop = async (event: DragEvent) => {
        handleRemoveDragOverClass()
        const element = getTargetNode(event.target as HTMLElement)
        if (!element) return
        const category = element.dataset.category as string
        if (!category) return
        const todoId = draggingTodoId.value
        const todo = todoStore.getTodoByIdFromLocal(todoId)
        if (todo && todo.state === category) return
        await todoStore.doUpdateTodo(todoId, {
            state: category as Todo['state']
        })
    }

    return {
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragEnd,
        handleDrop
    }
}
