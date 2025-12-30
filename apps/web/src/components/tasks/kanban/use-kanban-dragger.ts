import { ref } from 'vue'
import type { Todo } from '@nao-todo/types'

const useKanbanDragger = () => {
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

    const handleDrop = (event: DragEvent) => {
        handleRemoveDragOverClass()
        const element = getTargetNode(event.target as HTMLElement)
        if (!element) return
        const category = element.dataset.category as Todo['state']
        if (!category) return
        // const todoId = draggingTodoId.value
        // const todo = todos.value.find((todo) => todo.id === todoId)
        // if (todo && todo.state === category) return
        // todoStore.updateTodoByUpdateQueue(todoId, { state: category })
    }

    return {
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragEnd,
        handleDrop
    }
}

export default useKanbanDragger
