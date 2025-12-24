import { markRaw, ref } from 'vue'
import { watch, type Ref } from 'vue'

const useListMapper = <T extends { id: string }>(listRef: Ref<T[]>) => {
    // @computed Mapper
    const _map = ref<Map<T['id'], T>>()

    // @method 构建 List map
    const makeMap = (target: T[]): Map<T['id'], T> => {
        return new Map(target.map((item) => [item.id, markRaw(item)]))
    }

    // @method Get by id
    const get = (id: string): T | undefined => {
        if (!_map.value) return void 0
        return _map.value.get(id)
    }

    // @method Remove by id
    const remove = (id: string) => {
        if (!_map.value) return
        _map.value.delete(id)
    }

    // @method Add item
    const add = (item: T) => {
        if (!_map.value) return
        _map.value.set(item.id, item)
    }

    // @watch 监听 listRef 变化，更新 map
    watch(listRef, (newList) => (_map.value = makeMap(newList)), { immediate: true })

    return {
        // map: computed(() => _map.value),
        get,
        remove,
        add
    }
}

export default useListMapper
