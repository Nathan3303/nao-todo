import { useTagStore, useUserStore } from '@/stores'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import type { Tag, TagFilterOptions } from '@/stores'

const userStore = useUserStore()
const tagStore = useTagStore()

// Standards

export const getTags = async (filterOptions: TagFilterOptions) => {
    const userId = userStore.user!.id
    await tagStore.initialize(userId, filterOptions)
}

export const createTag = async (tagName: Tag['name'], tagColor: Tag['color']) => {
    const userId = userStore.user!.id
    const res = await tagStore.create(userId, { name: tagName, color: tagColor })
    if (res) {
        NueMessage.success('创建成功')
    } else {
        NueMessage.error('创建失败')
    }
    return res
}

export const updateTag = async (tagId: Tag['id'], updateInfo: Partial<Tag>) => {
    const userId = userStore.user!.id
    const res = await tagStore.update(userId, tagId, updateInfo)
    if (res) {
        NueMessage.success('更新成功')
    } else {
        NueMessage.error('更新失败')
    }
    return res
}

export const removeTag = async (tagId: Tag['id']) => {
    const userId = userStore.user!.id
    const res = await tagStore.remove(userId, tagId)
    if (res) {
        NueMessage.success('删除成功')
    } else {
        NueMessage.error('删除失败')
    }
    return res
}

// Extends
