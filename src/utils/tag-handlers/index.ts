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

export const removeTagWithConfirm = async (tagId: Tag['id']) => {
    return await NueConfirm({
        title: '删除标签',
        content: '确定要删除该标签吗？',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
    }).then(
        async () => await removeTag(tagId),
        (err) => err
    )
}

export const renameTagWithPrompt = async (tagId: Tag['id'], oldTagName?: Tag['name']) => {
    return await NuePrompt({
        title: '重命名标签',
        content: '请输入新的标签名称',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: oldTagName,
        validator: (value: string) => value
    }).then(
        async (newTagName) => await updateTag(tagId, { name: newTagName as Tag['name'] }),
        (err) => err
    )
}
