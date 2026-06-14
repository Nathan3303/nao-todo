import type { TagViewObject, ProjectViewObject } from '@nao-todo/types'

/** 内联组件类型 */
export type InlineChipType = 'tag' | 'project' | 'priority' | 'state'

/** 内联组件数据 — 对应一个 TagNode 或 TaskBasicInfo 实例 */
export type InlineChipData = {
    chipId: string // 唯一标识（用于 DOM 定位）
    type: InlineChipType
    entityId: string // 选中实体的 id (tagId / projectId)
    label: string // 显示文本（如 "工作"）
    color?: string // 标签颜色（仅 tag 有）
}

/** 输入组件 v-model 的值 */
export type TaskCreatorInputValue = {
    text: string // 纯文本（不含 chip 标签内容）
    tags: string[] // 选中的 tag id 列表
    projectId: string | null // 选中的 project id
    priority?: string | null // 选中的优先级
    state?: string | null // 选中的状态
}

/** 建议弹窗选项 */
export type SuggestionOption = {
    id: string
    label: string
    type: InlineChipType
    description?: string
    color?: string // 仅 tag 有
}

/** 触发状态 */
export type TriggerState = {
    active: boolean
    type: InlineChipType | null
    query: string
    startOffset: number // 触发字符在 textContent 中的位置
}

export type SelectOption = {
    label: string
    value: string
}

export type TaskCreatorInputProps = {
    modelValue: TaskCreatorInputValue
    tags: TagViewObject[]
    projects: ProjectViewObject[]
    priorityOptions?: SelectOption[]
    stateOptions?: SelectOption[]
    placeholder?: string
    disabled?: boolean
    maxLength?: number
    autofocus?: boolean
}

export type TaskCreatorInputEmits = {
    (e: 'update:modelValue', value: TaskCreatorInputValue): void
    (e: 'create-tag', name: string): void
    (e: 'focus'): void
    (e: 'blur'): void
}
