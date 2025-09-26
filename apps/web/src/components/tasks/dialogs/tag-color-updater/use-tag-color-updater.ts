import { useTagStore } from '@/stores/global'
import type { Tag } from '@nao-todo/types'
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'

const useTagColorUpdater = () => {
    const tagStore = useTagStore()

    const { tags } = storeToRefs(tagStore)
    const tagId = ref<Tag['id']>()
    const color = ref<Tag['color']>('transparent')
    const updating = ref(false)
    const disabled = ref(false)

    const getTagColor = (id: Tag['id']) => {
        // 判断 tagId 是否为空
        if (!id || id === '') {
            NueMessage.error('标签 ID 不能为空')
            return
        }
        // 记录 tagId
        tagId.value = id
        // 查找 Tag 数据
        const _tag = tags.value.find((tag) => tag.id === id) as Tag
        // 获取 Tag 颜色
        color.value = _tag ? _tag.color : 'transparent'
    }

    const updateTagColor = async (): Promise<boolean> => {
        // 判断 tagId 是否为空
        if (!tagId.value || tagId.value === '') {
            NueMessage.error('标签 ID 不能为空')
            return false
        }
        // 调用 API
        disabled.value = updating.value = true
        const err = await tagStore.updateTag(tagId.value, { color: color.value })
        updating.value = false
        // 处理结果
        if (err) {
            NueMessage.error(unwrapError(err))
            disabled.value = false
            return false
        }
        NueMessage.success('标签颜色修改成功')
        tagId.value = void 0
        color.value = 'transparent'
        return true
    }

    return {
        color,
        updating,
        disabled,
        getTagColor,
        updateTagColor
    }
}

export default useTagColorUpdater
