import type { InlineChipData } from './types'

type ChipRecord = {
    mountEl: HTMLElement
}

/**
 * 管理 contentEditable 内 chip 的挂载和卸载
 *
 * 使用纯 DOM 构建视觉元素（不依赖 Vue 组件渲染，避免 render() 孤立上下文
 * 导致全局注册的 NueUI 组件不可用的问题）。
 *
 * 每次 input 事件后需调用 reconcile() 修复浏览器对挂载点的破坏。
 */
export function useChipManager() {
    const chipMap = new Map<string, ChipRecord>()

    /**
     * 在指定 range 位置插入 chip
     */
    function mountChip(chipData: InlineChipData, range: Range): void {
        const span = document.createElement('span')
        span.className = 'vue-chip-mount'
        span.contentEditable = 'false'
        span.dataset.chipId = chipData.chipId
        span.dataset.chipType = chipData.type
        span.dataset.entityId = chipData.entityId
        span.dataset.label = chipData.label
        if (chipData.color) span.dataset.color = chipData.color

        // 构建 chip 内部 DOM
        const inner = buildChipDom(chipData)
        span.appendChild(inner)

        // 删除 range 内容（触发文本）后插入 span
        range.deleteContents()
        range.insertNode(span)

        // 将光标移到 span 之后
        range.setStartAfter(span)
        range.setEndAfter(span)

        chipMap.set(chipData.chipId, { mountEl: span })
    }

    /**
     * 根据 chipId 卸载 chip
     */
    function unmountChip(chipId: string): void {
        const record = chipMap.get(chipId)
        if (!record) return
        if (record.mountEl.parentNode) {
            record.mountEl.parentNode.removeChild(record.mountEl)
        }
        chipMap.delete(chipId)
    }

    /**
     * 根据 DOM 元素卸载 chip
     */
    function unmountChipByElement(el: HTMLElement): string | null {
        const chipId = el.dataset.chipId
        if (!chipId) return null
        unmountChip(chipId)
        return chipId
    }

    /**
     * 根据 chipType 查找第一个匹配的 chipId（用于单值类型如 priority/state）
     */
    function findChipByEntityType(chipType: string): string | null {
        for (const [chipId, record] of chipMap) {
            if (record.mountEl.dataset.chipType === chipType) {
                return chipId
            }
        }
        return null
    }

    /**
     * 遍历编辑器内所有挂载点，修复浏览器可能破坏的 chip
     * 对 DOM 中存在但 Map 中缺失的 chip 重新构建
     * 同 chipId 只保留第一个，删除后续重复
     */
    function reconcile(editor: HTMLElement): void {
        const mountEls = editor.querySelectorAll<HTMLElement>('.vue-chip-mount')
        const seenIds = new Set<string>()
        const foundIds = new Set<string>()

        mountEls.forEach((el) => {
            const chipId = el.dataset.chipId
            if (!chipId) return

            // 去重：同 chipId 只保留第一个
            if (seenIds.has(chipId)) {
                el.remove()
                return
            }
            seenIds.add(chipId)
            foundIds.add(chipId)

            const record = chipMap.get(chipId)
            if (record) return // 已管理，跳过

            // Map 中缺失 → 重新构建内部 DOM
            const chipData: InlineChipData = {
                chipId,
                type: (el.dataset.chipType as InlineChipData['type']) || 'tag',
                entityId: el.dataset.entityId || '',
                label: el.dataset.label || '',
                color: el.dataset.color || undefined
            }
            // 清空 span 后重建
            el.innerHTML = ''
            const inner = buildChipDom(chipData)
            el.appendChild(inner)
            chipMap.set(chipId, { mountEl: el })
        })

        // 清理 Map 中但 DOM 已不存在的 chip
        for (const [chipId] of chipMap) {
            if (!foundIds.has(chipId)) {
                chipMap.delete(chipId)
            }
        }
    }

    /**
     * 全部卸载
     */
    function destroy(): void {
        chipMap.clear()
    }

    return {
        mountChip,
        unmountChip,
        unmountChipByElement,
        findChipByEntityType,
        reconcile,
        destroy
    }
}

const CHIP_COLOR_MAP: Record<string, Record<string, string>> = {
    priority: {
        high: '#e74c3c',
        medium: '#f39c12',
        low: '#95a5a6'
    },
    state: {
        done: '#27ae60',
        'in-progress': '#3498db',
        todo: '#7f8c8d'
    }
}

/**
 * 构建 chip 内部的 DOM 元素
 *
 * 标签:  <span class="chip-inner chip-inner--tag">标签名</span>
 * 清单:  <span class="chip-inner chip-inner--project">📋 清单名</span>
 *
 * 使用 NueUI CSS 变量统一视觉，无需依赖全局注册的组件。
 */
function buildChipDom(chipData: InlineChipData): HTMLElement {
    const inner = document.createElement('span')
    inner.className = 'chip-inner'
    inner.dataset.type = chipData.type

    inner.classList.add(`chip-inner--${chipData.type}`)
    inner.textContent = chipData.label

    const color =
        chipData.color ||
        CHIP_COLOR_MAP[chipData.type]?.[chipData.entityId]
    if (color) {
        inner.style.setProperty('--chip-color', color)
    }

    return inner
}
