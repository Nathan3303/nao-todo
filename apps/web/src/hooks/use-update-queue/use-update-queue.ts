import { computed, ref } from 'vue'
// import { useTodoStore } from '@/stores/global'
import { type Err } from '@nao-todo/types'

// @type 更新队列项
export type UpdateQueueItem = {
    id: string
    updateOptions: Record<string, any>
}

// @type 更新队列项任务执行错误
type UpdateQueueError = UpdateQueueItem & { error: Err }

// @type 更新队列项重复处理函数 - 当多个更新队列项指向同一个任务时可以通过此函数处理
type DuplicateHandler = (item: UpdateQueueItem) => UpdateQueueItem

// @store TodoStore
// const todoStore = useTodoStore()

// @state 更新队列延时器
let timer: number | null = null

const useUpdateQueue = (handler: (item: UpdateQueueItem) => Promise<Err>, delay: number = 1000) => {
    // @states 更新队列 / 更新队列任务错误列表
    const updateQueue = ref<UpdateQueueItem[]>([])
    const errors = ref<UpdateQueueError[]>([])

    // @computed 更新队列运行状态
    const running = computed(() => updateQueue.value.length > 0)

    // @methods 运行函数
    const runner = async () => {
        const item = updateQueue.value.shift()
        if (item) {
            console.log('[UseUpdateQueue] shiftAndRun:', item.id, item.updateOptions)
            // if (handler) {
            handler(item)
            // }
            // else {
            //     const err = await todoStore.updateTodo(item.todoId, item.updateOptions)
            //     if (err) {
            //         errors.value.push({
            //             todoId: item.todoId,
            //             updateOptions: item.updateOptions,
            //             error: err
            //         })
            //     }
            // }
        }
        timer = null
        if (updateQueue.value.length) {
            shiftAndRun()
        }
    }

    // @method 启动运行器
    const shiftAndRun = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(runner, delay)
    }

    // @method 插入任务数据
    const insertItem = (item: UpdateQueueItem, duplicateHandler?: DuplicateHandler) => {
        const itemIndex = updateQueue.value.findIndex((i) => i.id === item.id)
        if (itemIndex !== -1) {
            const oldItem = updateQueue.value.splice(itemIndex, 1)[0]
            if (duplicateHandler) {
                const duplicateHandlerResult = duplicateHandler(item)
                if (duplicateHandlerResult) updateQueue.value.push(duplicateHandlerResult)
            } else {
                updateQueue.value.push({
                    id: oldItem.id,
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

    // @returns
    return {
        errors,
        running,
        queueLength: computed(() => updateQueue.value.length),
        printQueue: () => console.log(updateQueue.value),
        clearQueue: () => (updateQueue.value = []),
        insertItem
    }
}

export default useUpdateQueue
