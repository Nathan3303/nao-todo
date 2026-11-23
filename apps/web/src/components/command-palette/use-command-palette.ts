import { computed, ref, shallowRef } from 'vue'
import { t } from '@nao-todo/shared/locales'
import type { Command } from '@nao-todo/shared/commands'
import { registry } from '@/commands/instance'
import { detectPlatform } from '@/commands/platform'
import {
    buildPaletteEntries,
    filterPaletteEntries,
    flattenPaletteGroups,
    groupPaletteEntries
} from './palette-model'

/**
 * 命令面板数据面（DI 唯一入口）
 * @description 数据源**只有**命令注册表（`registry.getAll()`）：面板不手写命令/快捷键清单。
 *              注册表本身不是响应式的（`Map`）⇒ 面板每次打开时用 `refresh()` 取一次快照；
 *              日历等作用域命令随宿主挂载/卸载进出注册表，快照口径与之对齐。
 */
export const useCommandPalette = () => {
    const platform = detectPlatform()
    /** 查询词（输入即时过滤） */
    const query = ref('')
    /** 当前选中项（拍平序列的下标） */
    const activeIndex = ref(0)
    /** 注册表快照 */
    const snapshot = shallowRef<Command[]>([])

    const refresh = (): void => {
        snapshot.value = registry.getAll()
    }

    const entries = computed(() =>
        filterPaletteEntries(
            buildPaletteEntries(snapshot.value, {
                platform,
                wheelLabel: t('commands.key.wheel')
            }),
            query.value
        )
    )

    const groups = computed(() => groupPaletteEntries(entries.value))

    /** 拍平序列：↑/↓ 与执行都基于它（与 `aria-activedescendant` 的下标同源） */
    const options = computed(() => flattenPaletteGroups(groups.value))

    /** 当前选中项 id（空列表时为空串） */
    const activeId = computed(() => options.value[activeIndex.value]?.id ?? '')

    /** 复位到首项（查询变化 / 重新打开时调用） */
    const resetActive = (): void => {
        activeIndex.value = 0
    }

    /** ↑/↓ 循环移动（空列表不移动） */
    const move = (delta: number): void => {
        const total = options.value.length
        if (total === 0) return
        activeIndex.value = (activeIndex.value + delta + total) % total
    }

    const setActive = (index: number): void => {
        activeIndex.value = index
    }

    /** 查询变化：过滤结果必然变化 ⇒ 选中态回零 */
    const setQuery = (value: string): void => {
        query.value = value
        resetActive()
    }

    return {
        platform,
        query,
        setQuery,
        activeIndex,
        activeId,
        groups,
        options,
        refresh,
        resetActive,
        move,
        setActive
    }
}