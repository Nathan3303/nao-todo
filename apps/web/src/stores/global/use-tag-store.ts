import { defineStore } from 'pinia'
import { ref } from 'vue'
import { NueConfirm, NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import type { Err, GetTagsOptions, Tag, UpdateTagOptions } from '@nao-todo/types'
import {
    createTagHandler,
    deleteTagHandler,
    getTagsHandler,
    updateTagHandler
} from '@nao-todo/handlers/v1'

const useTagStore = defineStore('TagStore', () => {
    // @state 标签列表
    const tags = ref<Tag[]>([])

    // @method 获取标签列表
    const getTags = async (options: GetTagsOptions): Promise<Err> => {
        // 获取标签列表
        const [res, err] = await getTagsHandler(options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        tags.value  = res || []
        return null
    }

    // @method 创建标签
    const createTag = async (
        name: Tag['name'],
        color: Tag['color'],
        description?: Tag['description']
    ): Promise<Err> => {
        // 创建标签
        const createOptions = { name: name, color, description: description || '' }
        const [res, err] = await createTagHandler(createOptions, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        tags.value.push(res)
        return null
    }

    // @method 删除标签
    const deleteTag = async (tagId: Tag['id']): Promise<Err> => {
        // 参数判断
        if (!tagId) return '标签 ID 不能为空'
        // 删除标签
        const [, err] = await deleteTagHandler(tagId, false, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        tags.value = tags.value.filter((tag) => tag.id !== tagId)
        return null
    }

    // @method 删除标签（带确认）
    const deleteTagWithConfirm = async (tagId: Tag['id']): Promise<Err> => {
        return (await NueConfirm({
            title: '删除标签',
            content: '确定要删除此标签吗？',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const err = await deleteTag(tagId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return err
                }
                NueMessage.success('删除成功')
                return 'ok'
            }
        })) as Err
    }

    // @method 更新标签
    const updateTag = async (tagId: Tag['id'], options: UpdateTagOptions): Promise<Err> => {
        // 调用 API 更新标签
        const [, err] = await updateTagHandler(tagId, options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        tags.value.forEach((tag) => {
            if (tag.id !== tagId) return
            if (options.name) tag.name = options.name
            if (options.color) tag.color = options.color
            if (options.description) tag.description = options.description
        })
        return null
    }

    return {
        tags,
        getTags,
        createTag,
        deleteTag,
        deleteTagWithConfirm,
        updateTag
    }
})

export default useTagStore
