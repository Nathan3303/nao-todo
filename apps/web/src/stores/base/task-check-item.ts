import type { TaskCheckItemViewObject, UpdateTaskCheckItemViewObject } from '@nao-todo/usecases/task'
import { computed } from 'vue'
import { useMapperStoreBase } from '../hooks/use-mapper-store-base'
import { useListStoreBase } from '../hooks/use-list-store-base'

export const useTaskCheckItemsStoreBase = () => {
    const {
        map: checkItems,
        addItem: addCheckItem,
        getItem: getCheckItem,
        setList: setCheckItems,
        updateItem: updateCheckItem,
        removeItem: deleteCheckItem,
        updateList: updateCheckItems
    } = useMapperStoreBase<TaskCheckItemViewObject, UpdateTaskCheckItemViewObject>()

    // @returns
    return {
        checkItems,
        addCheckItem,
        getCheckItem,
        setCheckItems,
        updateCheckItem,
        deleteCheckItem,
        updateCheckItems
    }
}

export const useTaskCheckItemIdsStoreBase = (
    getTaskCheckItem: TaskCheckItemsStoreBase['getCheckItem']
) => {
    const {
        list: checkItemIds,
        setList: setCheckItemIds,
        addItem: addCheckItemId,
        removeItem: removeCheckItemId
    } = useListStoreBase<TaskCheckItemViewObject['id']>()

    // @state 检查事项数组 - 用于展示
    const checkItems = computed(() => {
        if (!checkItemIds.value) return []
        const _events = checkItemIds.value.map((id) => getTaskCheckItem(id)!).filter(Boolean)
        if (_events.length === 0) return []
        return _events.sort((a, b) => a.sortId - b.sortId)
    })

    // @return
    return {
        checkItemIds,
        checkItems,
        setCheckItemIds,
        addCheckItemId,
        removeCheckItemId
    }
}

export type TaskCheckItemsStoreBase = ReturnType<typeof useTaskCheckItemsStoreBase>
export type TaskCheckItemIdsStoreBase = ReturnType<typeof useTaskCheckItemIdsStoreBase>

