import { computed, ComputedRef, type Ref } from 'vue'

export type UseListMapper = <T extends { id: string }>(
    listRef: Ref<T[]>
) => {
    map: ComputedRef<Map<string, T>>
    get: (id: string) => T | undefined
}

const useListMapper: UseListMapper = (listRef) => {
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

    return { map, get }
}

export default useListMapper
