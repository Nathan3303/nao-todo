import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { createTag, deleteTag, updateTag, getTags } from '@nao-todo/apis'
import type {
    Tag,
    CreateTagOptions,
    UpdateTagOptions,
    GetTagsOptions,
    GetTagsOptionsRaw
} from '@nao-todo/types'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'

export const useTagStore = defineStore('tagStore', () => {
    const tags = ref<Tag[]>([])

    // 获取选项
    const getOptions = shallowRef<GetTagsOptions>({
        page: 1,
        limit: 99
    })

    // 修改获取选项
    const updateGetOptions = (newOptions: GetTagsOptions) => {
        getOptions.value = newOptions
    }

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
        // console.log('[UseTagStore] doCreateTag:', newProject)
        tags.value.push(newProject)
        return true
    }

    // 更新标签
    const doUpdateTag = async (tagId: Tag['id'], options: UpdateTagOptions) => {
        const result = await updateTag(tagId, options)
        if (result.code !== 20000) return false
        const index = tags.value.findIndex((tag) => tag.id === tagId)
        if (index === -1) return false
        const tag = tags.value[index]
        Object.keys(tag).forEach((key) => {
            if (options[key as keyof UpdateTagOptions]) {
                tag[key as keyof Tag] = options[key as keyof UpdateTagOptions] as never
            }
        })
        return true
    }

    // 获取标签
    const doGetTags = async () => {
        const result = await getTags(getOptions.value)
        if (result.code !== 20000) return false
        tags.value = result.data as Tag[]
        return true
    }

    // 删除标签
    const doDeleteTag = async (tagId: Tag['id']) => {
        const result = await deleteTag(tagId)
        if (result.code !== 20000) return false
        const index = tags.value.findIndex((tag) => tag.id === tagId)
        if (index !== -1) tags.value.splice(index, 1)
        return true
    }

    // 修改清单名称
    const updateTagNameWithPrompt = async (tagId: Tag['id'], currentName: Tag['name']) => {
        try {
            // 尝试更新项目标题
            const newName = await NuePrompt({
                title: '修改标签名称',
                placeholder: '请输入新的标签名称',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                inputValue: currentName,
                validator: (value: string) => value
            })

            const updateOptions = { name: newName } as UpdateTagOptions
            if (await doUpdateTag(tagId, updateOptions)) {
                NueMessage.success('标签名称修改成功')
                return true
            } else {
                NueMessage.error('标签名称修改失败')
            }
        } catch (err) {
            console.warn('[UseTagStore] updateTagNameWithPrompt:', err)
        }
        return false
    }

    // 更新标签颜色
    const updateTagColor = async (tagId: Tag['id'], color: Tag['color']) => {
        const result = await doUpdateTag(tagId, { color })
        if (result) {
            NueMessage.success('标签颜色修改成功')
        } else {
            NueMessage.error('标签颜色修改失败')
        }
        return result;
    }

    // 删除标签（带确认）
    const deleteTagWithConfirmation = async (tagId: Tag['id']) => {
        try {
            // 尝试删除项目
            await NueConfirm({
                title: '删除标签',
                content: '确定要删除此标签吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            if (await doDeleteTag(tagId)) {
                NueMessage.success('标签删除成功')
                return true
            } else {
                NueMessage.error('标签删除失败')
            }
        } catch (err) {
            console.warn('[UseTagStore] deleteTagWithConfirmation:', err)
        }
        return false
    }

    // 查找本地标签
    const getTagByIdFromLocal = (tagId: Tag['id']) => {
        const index = tags.value.findIndex((tag) => tag.id === tagId)
        if (index === -1) return null
        return tags.value[index]
    }

    // 查找本地标签(s)
    const findTagsFromLocal = (
        options: GetTagsOptionsRaw,
        predicate?: (key: string, tag: Tag, options: GetTagsOptionsRaw) => boolean | undefined
    ) => {
        return tags.value.filter((tag) => {
            return Object.keys(options).every((key) => {
                if (predicate) {
                    const result = predicate(key as keyof GetTagsOptionsRaw, tag, options)
                    if (typeof result === 'boolean') return result
                }
                return (
                    tag[key as keyof GetTagsOptionsRaw] === options[key as keyof GetTagsOptionsRaw]
                )
            })
        })
    }

    return {
        tags,
        smartListData,
        getOptions,
        updateGetOptions,
        doCreateTag,
        doUpdateTag,
        doGetTags,
        doDeleteTag,
        updateTagNameWithPrompt,
        updateTagColor,
        deleteTagWithConfirmation,
        findTagsFromLocal,
        getTagByIdFromLocal
    }
})
