import { computed, ref } from 'vue'

/**
 * 列表状态管理
 * @template T 列表项类型
 * @returns 列表状态管理对象
 */
export const useListStoreBase = <T>() => {
    // @state 列表
    const list = ref<T[]>([])

    /**
     * 设置列表
     * @param newList 新列表
     */
    const setList = (newList: T[]) => {
        list.value = newList
    }

    /**
     * 添加列表项
     * @param newItem 新列表项
     */
    const addItem = (newItem: T) => {
        if (list.value === null || list.value === void 0) return
        let isExist = false
        if (list.value.length !== 0) {
            isExist = list.value.indexOf(newItem as never) !== -1
        }
        if (isExist) return
        list.value.push(newItem as never)
    }

    /**
     * 添加列表项
     * @param newItems 新列表项
     */
    const addItems = (newItems: T[]) => {
        newItems.forEach((item) => addItem(item as never))
    }

    /**
     * 删除列表项
     * @param targetItem 目标列表项
     */
    const removeItem = (targetItem: T) => {
        if (list.value === null || list.value === void 0) return
        list.value = list.value.filter((item) => item !== targetItem)
    }

    /**
     * 删除列表项
     * @param targetItems 目标列表项
     */
    const removeItems = (targetItems: T[]) => {
        targetItems.forEach((item) => removeItem(item as never))
    }

    // @return 列表状态管理对象
    return {
        list: computed(() => list.value),
        setList,
        addItem,
        addItems,
        removeItem,
        removeItems
    }
}