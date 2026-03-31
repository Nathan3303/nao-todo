import type { TagViewObject, UpdateTagViewObject } from '@nao-todo/types'
import { computed, ref } from 'vue'

const useTagsStoreBase = () => {
    // @state 标签列表
    const tags = ref<TagViewObject[]>([])

    // @computed 标签视图对象 Map
    const tagsMap = computed(() => {
        return new Map(tags.value.map((item) => [item.id, item]))
    })

    // @action 设置标签视图对象数组
    const setTags = (newTags: TagViewObject[]) => {
        tags.value = newTags
    }

    // @action 添加标签
    const addTag = (t: TagViewObject) => {
        const isExist = tagsMap.value.has(t.id)
        if (isExist) return
        tags.value.push(t)
    }

    // @action 更新标签
    const updateTag = (id: TagViewObject['id'], t: UpdateTagViewObject) => {
        const idx = tags.value.findIndex((item) => item.id === id)
        if (idx === -1) return
        tags.value[idx] = { ...tags.value[idx], ...t }
    }

    // @action 获取单个标签
    const getTag = (id: TagViewObject['id']) => {
        return tagsMap.value.get(id)
    }

    // @returns
    return {
        tags,
        setTags,
        addTag,
        updateTag,
        getTag
    }
}

export default useTagsStoreBase
export type TagsStoreBase = ReturnType<typeof useTagsStoreBase>
