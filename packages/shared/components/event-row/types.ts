export type EventInfo = {
    id: string
    name: string
    isDone: boolean
}

export type EventRowUpdatePayload = Partial<EventInfo>

export type EventRowProps = {
    event: EventInfo
    onUpdate: (id: string, payload: EventRowUpdatePayload) => Promise<void>
    onDelete: (id: string) => Promise<void>
    /**
     * 只读（`T795`）：已归档任务等只读场景下禁止勾选 / 改名 / 删除 / 拖拽
     * @description 只读时 `draggable` 置 false、拖拽手柄与操作列不渲染（编辑入口「不存在」而非「点了没反应」）
     * @default false
     */
    readonly?: boolean
}

export type EventRowEmits = {
    (event: 'toTask', id: string): void
}