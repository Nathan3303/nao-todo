// 事件行拖拽处理函数类型
type EventDraggerHandler = (dragged: HTMLElement, dropped: HTMLElement, isUp: boolean) => void

// 拖拽 composable 选项
type EventDraggerOptions = {
    /** 行元素选择器（用于重置拖拽态） */
    rowSelector?: string
    /** 列表容器选择器（同列表守卫 + 拖拽离开判定） */
    listSelector?: string
    /** 行 ID 的 dataset 键（drop 守卫：双方均须有该键） */
    idKey?: string
}

// 默认值 = 检查项列表既有契约（保持行为不变）
const DEFAULT_OPTIONS: Required<EventDraggerOptions> = {
    rowSelector: '.nue-div--event-row',
    listSelector: '.nue-div--event-list',
    idKey: 'eid'
}

// 交互元素：从其发起 dragstart 时不进入拖拽（防误触勾选/点名称/脱离）
const INTERACTIVE_SELECTOR = 'button, input, a, textarea, select, [data-no-drag]'

// 自定义拖拽预览（drag image / ghost）不透明度：默认预览过实会压住插入指示线
const DRAG_IMAGE_OPACITY = 0.35

/**
 * 事件行拖拽处理函数
 * @param handler 事件行拖拽处理函数
 * @param options 选择器与 dataset 键（默认值保持检查项契约不变）
 * @returns
 */
const useEventDragger = (handler: EventDraggerHandler, options: EventDraggerOptions = {}) => {
    const { rowSelector, listSelector, idKey } = { ...DEFAULT_OPTIONS, ...options }

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
        const eventRows = document.querySelectorAll(rowSelector) as unknown as HTMLElement[]
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
     * 同列表守卫：被拖拽与目标必须落在同一列表容器内
     */
    const isSameList = (a: HTMLElement, b: HTMLElement): boolean => {
        const listA = a.closest(listSelector)
        const listB = b.closest(listSelector)
        return listA !== null && listA === listB
    }

    /**
     * 处理事件行拖拽开始事件
     * @param event 事件行拖拽开始事件
     */
    const handleDragStart = (event: DragEvent) => {
        // 交互元素（勾选/名称/脱离等）不触发拖拽，防误触
        const target = event.target as HTMLElement | null
        if (target?.closest?.(INTERACTIVE_SELECTOR)) {
            event.preventDefault()
            dragged = null
            return
        }
        event.dataTransfer!.setData('text/plain', 'event')
        event.dataTransfer!.effectAllowed = 'move'
        event.dataTransfer!.dropEffect = 'move'
        dragged = getTargetNode(event.target as HTMLElement)
        resetDragElementDOD()
        if (dragged) {
            dragged.dataset['dragging'] = 'true'
            // 自定义半透明拖拽预览（跟随光标的 ghost），避免默认预览过实压住插入 bar
            applyDragImage(event, dragged)
        }
    }

    /**
     * 应用自定义拖拽预览（drag image / ghost）
     * @description `cloneNode(true)` 被拖行 → 半透明 + `position: fixed` 离屏挂 body
     *              （Firefox 要求预览元素在文档树内）→ `setDragImage(clone, offsetX, offsetY)`
     *              按 `clientX/Y - rect.left/top` 保持光标对位；`dragstart` 后异步移除，防 DOM 泄漏。
     *              两列表共用本 composable ⇒ 子任务与检查项同时生效。
     */
    const applyDragImage = (event: DragEvent, source: HTMLElement) => {
        if (typeof event.dataTransfer?.setDragImage !== 'function') return
        const rect = source.getBoundingClientRect()
        const clone = source.cloneNode(true) as HTMLElement
        clone.style.position = 'fixed'
        clone.style.top = '-1000px'
        clone.style.left = '-1000px'
        clone.style.width = `${rect.width}px`
        clone.style.margin = '0'
        clone.style.opacity = String(DRAG_IMAGE_OPACITY)
        clone.style.pointerEvents = 'none'
        // 灰色底 + 圆角（与行 hover 同款；变量定义在 :root，body 挂载可继承解析）
        clone.style.backgroundColor = 'var(--nue-primary-color-100)'
        clone.style.borderRadius = 'var(--nue-primary-radius)'
        document.body.appendChild(clone)
        event.dataTransfer.setDragImage(clone, event.clientX - rect.left, event.clientY - rect.top)
        // 预览已被浏览器捕获 ⇒ 异步移除（勿泄漏 DOM）
        setTimeout(() => clone.remove(), 0)
    }

    /**
     * 处理事件行拖拽悬停事件
     * @param event 事件行拖拽悬停事件
     */
    const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
        dropped = getTargetNode(event.target as HTMLElement)
        if (!dropped || dragged === dropped) return
        // 同列表守卫：跨列表拖拽不显示插入指示线
        if (dragged && !isSameList(dragged, dropped)) return
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
            const parent = relatedTarget.closest(listSelector)
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
        if (dragged === dropped) return
        // 同列表守卫 + ID 守卫（双方均须带 idKey）
        if (!isSameList(dragged, dropped)) return
        if (!dragged.dataset[idKey] || !dropped.dataset[idKey]) return
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