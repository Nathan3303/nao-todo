// 事件行拖拽处理函数类型
type EventDraggerHandler = (dragged: HTMLElement, dropped: HTMLElement, isUp: boolean) => void

/**
 * 事件行拖拽处理函数
 * @param handler 事件行拖拽处理函数
 * @returns
 */
const useEventDragger = (handler: EventDraggerHandler) => {
    // 事件行拖拽元素
    let dragged: HTMLElement | null = null

    // 事件行拖拽目标元素
    let dropped: HTMLElement | null = null

    // 事件行拖拽方向
    let isUp: boolean = true

    /**
     * 重置事件行拖拽元素的拖拽方向
     */
    const resetDragElementDOD = () => {
        const eventRows = document.querySelectorAll(
            '.nue-div--event-row'
        ) as unknown as HTMLElement[]
        eventRows.forEach((row) => {
            row.dataset['dod'] = 'none'
            row.dataset['dragging'] = 'false'
        })
    }

    /**
     * 获取事件行拖拽目标元素
     * @param node 事件行拖拽目标元素
     * @returns 事件行拖拽目标元素
     */
    const getTargetNode = (node: HTMLElement) => {
        while (node) {
            if (!(node instanceof HTMLElement)) {
                return null
            }
            if (node.dataset['dragItem'] === 'true') {
                return node
            }
            if (node.parentNode) {
                node = node.parentNode as HTMLElement
            } else {
                break
            }
        }
        return null
    }

    /**
     * 处理事件行拖拽开始事件
     * @param event 事件行拖拽开始事件
     */
    const handleDragStart = (event: DragEvent) => {
        event.dataTransfer!.setData('text/plain', 'event')
        event.dataTransfer!.effectAllowed = 'move'
        event.dataTransfer!.dropEffect = 'move'
        dragged = getTargetNode(event.target as HTMLElement)
        if (dragged) {
            dragged.dataset['dragging'] = 'true'
        }
        resetDragElementDOD()
    }

    /**
     * 处理事件行拖拽悬停事件
     * @param event 事件行拖拽悬停事件
     */
    const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
        dropped = getTargetNode(event.target as HTMLElement)
        if (!dropped || dragged === dropped) return
        event.dataTransfer!.dropEffect = 'move'
        const { y: dropElementY, height: dropElementH } = dropped.getBoundingClientRect()
        const dropElementCenterY = dropElementY + dropElementH / 2
        isUp = event.clientY < dropElementCenterY

        resetDragElementDOD()
        if (dragged) {
            dragged.dataset['dragging'] = 'true'
        }
        dropped.dataset['dod'] = isUp ? 'up' : 'down'
    }

    /**
     * 处理事件行拖拽离开事件
     * @param event 事件行拖拽离开事件
     */
    const handleDragLeave = (event: DragEvent) => {
        event.preventDefault()
        const relatedTarget = event.relatedTarget as HTMLElement | null
        if (relatedTarget) {
            const parent = relatedTarget.closest('.nue-div--event-list')
            if (parent) return
        }
        resetDragElementDOD()
    }

    /**
     * 处理事件行拖拽释放事件
     * @param event 事件行拖拽释放事件
     */
    const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        if (!dragged || !dropped) return
        handler(dragged, dropped, isUp)
    }

    /**
     * 处理事件行拖拽结束事件
     * @param event 事件行拖拽结束事件
     */
    const handleDragEnd = (event: DragEvent) => {
        event.preventDefault()
        resetDragElementDOD()
    }

    /**
     * 事件行拖拽处理函数 返回值
     */
    return { handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop }
}

export default useEventDragger