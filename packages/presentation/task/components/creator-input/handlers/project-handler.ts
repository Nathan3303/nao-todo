import type { TriggerHandler } from '../trigger-registry'
import type { TaskProjectViewObject } from '../../../types'

export const projectHandler: TriggerHandler = {
    character: '@',
    type: 'project',
    headerLabel: '清单',
    isSingleValue: true,
    canCreate: false,
    dataSourceKey: 'projects',
    valueKey: 'projectId',
    defaultValue: null,

    getFilteredOptions(query, dataSource) {
        const q = query.toLowerCase()
        return (dataSource as TaskProjectViewObject[])
            .filter((p) => p.name.toLowerCase().includes(q))
            .map((p) => ({
                id: p.id,
                label: p.name,
                type: 'project' as const
            }))
    },

    buildChipHtmlString(entityId, chipId, dataSource) {
        const project = (dataSource as TaskProjectViewObject[]).find((p) => p.id === entityId)
        if (!project) return null
        return `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="project" data-entity-id="${project.id}" data-label="${project.name}"></span>`
    },

    buildChipContent(chipData) {
        const inner = document.createElement('span')
        inner.className = 'chip-inner chip-inner--project'
        inner.textContent = chipData.label
        return inner
    },

    extractChipValue(el) {
        return el.dataset.entityId ?? null
    }
}
