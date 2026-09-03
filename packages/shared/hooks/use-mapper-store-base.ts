import { computed, ref } from 'vue'

/**
 * 映射状态管理
 * @template T 映射项类型
 * @template U 更新类型
 * @returns 映射状态管理对象
 */
export const useMapperStoreBase = <T extends { id: string }, U = void>() => {
    // @state 映射
    const map = ref<Map<T['id'], T>>(new Map())

    /**
     * 设置映射
     * @param newList 新映射
     */
    const setList = (newList: T[]) => {
        map.value = new Map(newList.map((item) => [item.id, item]))
    }

    /**
     * 更新映射
     * @param newList 新映射
     */
    const updateList = (newList: T[]) => {
        newList.forEach((item) => updateItem(item.id, item as never))
    }

    /**
     * 获取映射项
     * @param id 映射项ID
     * @returns 映射项
     */
    const getItem = (id: T['id']): T | undefined => {
        return map.value.get(id) as T | undefined
    }

    /**
     * 添加映射项
     * @param newItem 新映射项
     */
    const addItem = (newItem: T) => {
        map.value.set(newItem.id, newItem as never)
    }

    /**
     * 添加映射项
     * @param newItems 新映射项
     */
    const addItems = (newItems: T[]) => {
        newItems.forEach((item) => addItem(item as never))
    }

    /**
     * 更新映射项
     * @param id 映射项ID
     * @param newItem 新映射项
     */
    const updateItem = (id: T['id'], newItem: T | U) => {
        map.value.set(id, newItem as never)
    }

    /**
     * 自定义更新映射项
     * @param id 映射项ID
     * @param handler 更新函数
     */
    const updateItemCustomly = (id: T['id'], handler: (item: T) => T) => {
        const oldItem = map.value.get(id)
        const newItem = handler(oldItem as T)
        map.value.set(id, newItem as never)
    }

    /**
     * 更新映射项
     * @param id 映射项ID
     * @param patched 更新字段
     */
    const patchItem = (id: T['id'], patched: Partial<T> | U) => {
        updateItemCustomly(id, (item) => {
            return { ...item, ...patched } as T
        })
    }
    /**
     * 删除映射项
     * @param id 映射项ID
     */
    const removeItem = (id: T['id']) => {
        map.value.delete(id)
    }

    // @returns 映射状态管理对象
    return {
        map: computed(() => map.value),
        list: computed(() => [...map.value.values()]),
        setList,
        updateList,
        getItem,
        addItem,
        addItems,
        updateItem,
        updateItemCustomly,
        patchItem,
        removeItem
    }
}