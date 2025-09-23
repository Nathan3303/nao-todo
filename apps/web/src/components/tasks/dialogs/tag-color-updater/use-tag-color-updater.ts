import { useTagStore } from '@/stores/global'
import type { Tag } from '@nao-todo/types'
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'

export type TagColorUpdaterProps = {
    tagId: Tag['id']
}

export type TagColorUpdaterEmits = {
    (e: 'closeDialog'): void
}

const useTagColorUpdater = (props: TagColorUpdaterProps, emit: TagColorUpdaterEmits) => {
    const tagStore = useTagStore()

    const { tags } = storeToRefs(tagStore)
    const color = ref<Tag['color']>('transparent')
    const updating = ref(false)
    const disabled = ref(false)

    const getTagColor = () => {
        const _tag = tags.value.find((tag) => tag.id === props.tagId) as Tag
        color.value = _tag ? _tag.color : 'transparent'
    }

    const updateTagColor = async () => {
        // 调用 API
        disabled.value = updating.value = true
        const err = await tagStore.updateTag(props.tagId, { color: color.value })
        updating.value = false
        emit('closeDialog')
        // 处理结果
        if (err) {
            NueMessage.error(unwrapError(err))
            disabled.value = false
            return
        }
        NueMessage.success('标签颜色修改成功')
        return
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
