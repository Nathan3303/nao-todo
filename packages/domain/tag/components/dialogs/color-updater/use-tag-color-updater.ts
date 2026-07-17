import { NueMessage } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { reactive } from 'vue'
import { TagHandler } from '../../../handlers'
import { useTagsStore } from '../../../stores'
import type { TagColorUpdaterDialogProps } from './types'

export const useTagColorUpdater = (props: TagColorUpdaterDialogProps) => {
    const { tagUseCase, subscriber } = props
    const tagsStore = useTagsStore()
    const { tags } = storeToRefs(tagsStore)
    const tagHandler = new TagHandler(tagUseCase, tagsStore, subscriber)

    const states = reactive({
        tagId: null as string | null,
        color: 'transparent',
        updating: false,
        disabled: false
    })

    /**
     * 获取标签颜色
     * @param id 标签 ID
     */
    const getTagColor = (id: string) => {
        if (!id) {
            NueMessage.error('标签 ID 不能为空')
            return
        }
        states.tagId = id
        const tag = tags.value.find((t) => t.id === id)
        states.color = tag?.color || 'transparent'
    }

    /**
     * 更新标签颜色
     * @returns 是否成功
     */
    const updateTagColor = async (): Promise<boolean> => {
        if (!states.tagId) {
            NueMessage.error('标签 ID 不能为空')
            return false
        }
        states.disabled = states.updating = true
        const err = await tagHandler.updateTagColor(states.tagId, states.color)
        states.updating = false
        if (err !== null) {
            states.disabled = false
            return false
        }
        states.tagId = null
        states.color = 'transparent'
        return true
    }

    // @returns
    return { states, getTagColor, updateTagColor }
}
