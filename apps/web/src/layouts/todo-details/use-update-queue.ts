import { ref } from 'vue'
import { useTodoStore } from '@/stores'
import type { Todo, UpdateTodoOptions } from '@nao-todo/types'

type UpdateQueueItem = {
    todoId: Todo['id']
    updateOptions: UpdateTodoOptions
}

type DuplicateHandler = (item: UpdateQueueItem) => UpdateQueueItem

const todoStore = useTodoStore()

let timer: number | null = null

export const useUpdateQueue = () => {
    const updateQueue = ref<UpdateQueueItem[]>([])

    const printQueue = () => console.log(updateQueue.value)

    const clearQueue = () => (updateQueue.value = [])

    const shiftAndRun = () => {
        if (timer) return
        timer = setTimeout(async () => {
            const item = updateQueue.value.shift()
            if (item) {
                // console.log('[UseUpdateQueue] shiftAndRun:', item.todoId, item.updateOptions)
                await todoStore.doUpdateTodo(item.todoId, item.updateOptions)
            }
            timer = null
            if (updateQueue.value.length) shiftAndRun()
        }, 1000) as unknown as number
    }

    const insertItem = (item: UpdateQueueItem, duplicateHandler?: DuplicateHandler) => {
        const itemIndex = updateQueue.value.findIndex((i) => i.todoId === item.todoId)
        if (itemIndex !== -1) {
            const oldItem = updateQueue.value.splice(itemIndex, 1)[0]
            if (duplicateHandler) {
                const duplicateHandlerResult = duplicateHandler(item)
                if (duplicateHandlerResult) updateQueue.value.push(duplicateHandlerResult)
            } else {
                updateQueue.value.push({
                    todoId: oldItem.todoId,
                    updateOptions: {
                        ...oldItem.updateOptions,
                        ...item.updateOptions
                    }
                })
            }
        } else {
            updateQueue.value.push(item)
        }
        // printQueue()
        shiftAndRun()
    }

    return {
        printQueue,
        insertItem,
        clearQueue
    }
}
