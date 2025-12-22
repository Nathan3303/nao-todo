import { computed, type ComputedRef, type Ref } from 'vue'

export type UseListMapper = <T extends { id: string }>(
    listRef: Ref<T[]>
) => {
    map: ComputedRef<Map<string, T>>
    get: (id: string) => T | undefined
    remove: (id: string) => void
    add: (item: T) => void
}

const useListMapper: UseListMapper = <T extends { id: string }>(listRef: Ref<T[]>) => {
    // @computed Mapper
    const map = computed(() => {
        return new Map(
            listRef.value.map((item) => {
                return [item.id, item]
            })
        )
    })

    // @method Get by id
    const get = (id: string) => {
        return map.value.get(id)
    }

    // @method Remove by id
    const remove = (id: string) => {
        map.value.delete(id)
    }

    // @method Add
    const add = (item: T) => {
        map.value.set(item.id, item)
    }

    return { map, get, remove, add }
}

export default useListMapper
