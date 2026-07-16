import type { TriggerHandler } from '../trigger-registry'
import type { SelectOption } from '../types'

const STATE_PRESETS: SelectOption[] = [
  { label: 'Todo', value: 'todo' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Done', value: 'done' }
]

const STATE_COLORS: Record<string, string> = {
  done: '#27ae60',
  'in-progress': '#3498db',
  todo: '#7f8c8d'
}

export const stateHandler: TriggerHandler = {
  character: '~',
  type: 'state',
  headerLabel: '状态',
  isSingleValue: true,
  canCreate: false,
  dataSourceKey: 'stateOptions',
  valueKey: 'state',
  defaultValue: null,

  getFilteredOptions(query, dataSource) {
    const options = (dataSource?.length ? dataSource : STATE_PRESETS) as SelectOption[]
    const q = query.toLowerCase()
    return options
      .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      .map((o) => ({
        id: o.value,
        label: o.label,
        type: 'state' as const
      }))
  },

  buildChipHtmlString(entityId, chipId, dataSource) {
    const options = (dataSource?.length ? dataSource : STATE_PRESETS) as SelectOption[]
    const opt = options.find((o) => o.value === entityId)
    if (!opt) return null
    return `<span class="vue-chip-mount" contenteditable="false" data-chip-id="${chipId}" data-chip-type="state" data-entity-id="${opt.value}" data-label="${opt.label}"></span>`
  },

  buildChipContent(chipData) {
    const inner = document.createElement('span')
    inner.className = 'chip-inner chip-inner--state'
    inner.textContent = chipData.label
    const color = STATE_COLORS[chipData.entityId]
    if (color) inner.style.setProperty('--chip-color', color)
    return inner
  },

  extractChipValue(el) {
    return el.dataset.entityId ?? null
  }
}
