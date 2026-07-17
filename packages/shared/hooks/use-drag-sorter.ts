// SortHandler 拖拽排序处理函数类型
export type SortHandler = (dragged: HTMLElement, dropped: HTMLElement, isUp: boolean) => void

/**
 * 拖拽排序器
 * @param handler 拖拽排序处理函数
 * @returns 拖拽排序器实例
 */
export const useDragSorter = (handler: SortHandler) => {
    // 拖拽中的元素
    let dragged: HTMLElement | null = null
    // 拖拽到的元素
    let dropped: HTMLElement | null = null
    // 是否向上拖拽
    let isUp: boolean = true

    /**
     * 重置拖拽元素的DOD属性
     * DOD属性：拖拽元素的原始位置
     */
    const resetDragElementDOD = () => {
        const items = document.querySelectorAll(
            '[data-drag-item="true"]'
        ) as unknown as HTMLElement[]
        items.forEach((item) => {
            item.dataset['dod'] = 'none'
            item.dataset['dragging'] = 'false'
        })
    }

    /**
     * 获取拖拽目标节点
     * @param node 拖拽目标节点
     * @returns 拖拽目标节点
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
     * 处理拖拽开始事件
     * @param event 拖拽开始事件
     */
    const handleDragStart = (event: DragEvent) => {
        event.dataTransfer!.setData('text/plain', 'project')
        event.dataTransfer!.effectAllowed = 'move'
        event.dataTransfer!.dropEffect = 'move'
        dragged = getTargetNode(event.target as HTMLElement)
        if (dragged) {
            dragged.dataset['dragging'] = 'true'

            const rect = dragged.getBoundingClientRect()
            const ghost = dragged.cloneNode(true) as HTMLElement
            ghost.style.position = 'fixed'
            ghost.style.top = '-9999px'
            ghost.style.left = '-9999px'
            ghost.style.opacity = '0.4'
            ghost.style.pointerEvents = 'none'
            ghost.style.zIndex = '-1'
            document.body.appendChild(ghost)
            event.dataTransfer!.setDragImage(
                ghost,
                event.clientX - rect.left,
                event.clientY - rect.top
            )
            requestAnimationFrame(() => ghost.remove())
        }
        resetDragElementDOD()
    }

    /**
     * 处理拖拽悬停事件
     * @param event 拖拽悬停事件
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
     * 处理拖拽离开事件
     * @param event 拖拽离开事件
     */
    const handleDragLeave = (event: DragEvent) => {
        event.preventDefault()
        const relatedTarget = event.relatedTarget as HTMLElement | null
        if (relatedTarget) {
            const parent = relatedTarget.closest('.nue-div--links')
            if (parent) return
        }
        resetDragElementDOD()
    }

    /**
     * 处理拖拽释放事件
     * @param event 拖拽释放事件
     */
    const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        if (!dragged || !dropped) return
        handler(dragged, dropped, isUp)
    }

    /**
     * 处理拖拽结束事件
     * @param event 拖拽结束事件
     */
    const handleDragEnd = (event: DragEvent) => {
        event.preventDefault()
        resetDragElementDOD()
    }

    // @returns
    return {
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDragEnd,
        handleDrop
    }
}
