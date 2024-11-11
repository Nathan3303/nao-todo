import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createTag, deleteTag, updateTag, getTags } from '@nao-todo/apis'
import type { Tag, CreateTagOptions, UpdateTagOptions, GetTagsOptions } from '@nao-todo/types'

export const useTagStore = defineStore('tagStore', () => {
    const tags = ref<Tag[]>([])

    // 获取选项
    const getOptions = ref<GetTagsOptions>({
        page: 1,
        limit: 10
    })

    // 智能标签列表
    const smartListData = computed<Tag[]>(() => {
        return tags.value.filter((tag) => {
            return !tag.isDeleted
        })
    })

    // 添加标签
    const doCreateTag = async (options: CreateTagOptions) => {
        const result = await createTag(options)
        if (result.code !== 20000) return false
        const newProject = result.data as Tag
        console.log('[UseTagStore] doCreateTag:', newProject)
        tags.value.push(newProject)
    }

    // 更新标签
    const doUpdateTag = async (tagId: Tag['id'], options: UpdateTagOptions) => {
        const result = await updateTag(tagId, options)
        if (result.code !== 20000) return false
        const index = tags.value.findIndex((tag) => tag.id === tagId)
        if (index === -1) return false
        const tag = tags.value[index]
        const projectKeys = Object.keys(tag)
        for (const key in projectKeys) {
            if (!(key in options)) continue
            tag[key as keyof Tag] = options[key as keyof UpdateTagOptions] as never
        }
    }

    // 获取标签
    const doGetTags = async () => {
        const result = await getTags(getOptions.value)
        if (result.code !== 20000) return false
        tags.value = result.data as Tag[]
    }

    // 删除标签
    const doDeleteTag = async (tagId: Tag['id']) => {
        const result = await deleteTag(tagId)
        if (result.code !== 20000) return false
        const index = tags.value.findIndex((tag) => tag.id === tagId)
        if (index !== -1) tags.value.splice(index, 1)
        return true
    }

    return {
        tags,
        smartListData,
        doCreateTag,
        doUpdateTag,
        doGetTags,
        doDeleteTag
    }
})
