type EventDraggerHandler = (dragged: HTMLElement, dropped: HTMLElement, isUp: boolean) => void

const useEventDragger = (handler: EventDraggerHandler) => {
    let dragged: HTMLElement | null = null
    let dropped: HTMLElement | null = null
    let isUp: boolean = true

    const resetDragElementDOD = () => {
        const eventRows = document.querySelectorAll(
            '.nue-div--event-row'
        ) as unknown as HTMLElement[]
        eventRows.forEach((row) => {
            row.dataset['dod'] = 'none'
            row.dataset['dragging'] = 'false'
        })
    }

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

    const handleDragLeave = (event: DragEvent) => {
        event.preventDefault()
        const relatedTarget = event.relatedTarget as HTMLElement | null
        if (relatedTarget) {
            const parent = relatedTarget.closest('.nue-div--event-list')
            if (parent) return
        }
        resetDragElementDOD()
    }

    const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        if (!dragged || !dropped) return
        handler(dragged, dropped, isUp)
    }

    const handleDragEnd = (event: DragEvent) => {
        event.preventDefault()
        resetDragElementDOD()
    }

    return { handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop }
}

export default useEventDragger
