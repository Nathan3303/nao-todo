import type { TriggerHandler } from '../trigger-registry'
import type { SelectOption } from '../types'

const PRIORITY_PRESETS: SelectOption[] = [
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
]

const PRIORITY_COLORS: Record<string, string> = {
    high: '#e74c3c',
    medium: '#f39c12',
    low: '#95a5a6'
}

export const priorityHandler: TriggerHandler = {
    character: '!',
    type: 'priority',
    headerLabel: '优先级',
    isSingleValue: true,
    canCreate: false,
    dataSourceKey: 'priorityOptions',
    valueKey: 'priority',
    defaultValue: null,

    getFilteredOptions(query, dataSource) {
        const options = (dataSource?.length ? dataSource : PRIORITY_PRESETS) as SelectOption[]
        const q = query.toLowerCase()
        return options
            .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
            .map((o) => ({
                id: o.value,
                label: o.label,
                type: 'priority' as const
            }))
    },

    buildChipHtmlString(entityId, chipId, dataSource) {
        const options = (dataSource?.length ? dataSource : PRIORITY_PRESETS) as SelectOption[]
        const opt = options.find((o) => o.value === entityId)
        if (!opt) return null
        return `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="priority" data-entity-id="${opt.value}" data-label="${opt.label}"></span>`
    },

    buildChipContent(chipData) {
        const inner = document.createElement('span')
        inner.className = 'chip-inner chip-inner--priority'
        inner.textContent = chipData.label
        const color = PRIORITY_COLORS[chipData.entityId]
        if (color) inner.style.setProperty('--chip-color', color)
        return inner
    },

    extractChipValue(el) {
        return el.dataset.entityId ?? null
    }
}
