import type { TriggerHandler } from '../trigger-registry'
import type { TaskTagViewObject } from '../../../types'

export const tagHandler: TriggerHandler = {
    character: '#',
    type: 'tag',
    headerLabel: '标签',
    getCreateLabel(query: string) {
        return `创建标签 "${query}"`
    },
    isSingleValue: false,
    canCreate: true,
    dataSourceKey: 'tags',
    valueKey: 'tags',
    defaultValue: [],

    getFilteredOptions(query, dataSource) {
        const q = query.toLowerCase()
        return (dataSource as TaskTagViewObject[])
            .filter((t) => t.name.toLowerCase().includes(q))
            .map((t) => ({
                id: t.id,
                label: t.name,
                type: 'tag' as const,
                color: t.color
            }))
    },

    buildChipHtmlString(entityId, chipId, dataSource) {
        const tag = (dataSource as TaskTagViewObject[]).find((t) => t.id === entityId)
        if (!tag) return null
        const colorAttr = tag.color ? ` data-color="${tag.color}"` : ''
        return `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="tag" data-entity-id="${tag.id}" data-label="${tag.name}"${colorAttr}></span>`
    },

    buildChipContent(chipData) {
        const inner = document.createElement('span')
        inner.className = 'chip-inner chip-inner--tag'
        inner.textContent = chipData.label
        if (chipData.color) {
            inner.style.setProperty('--chip-color', chipData.color)
        }
        return inner
    },

    extractChipValue(el) {
        return el.dataset.entityId ?? null
    }
}
