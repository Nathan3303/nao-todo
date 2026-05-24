import { inject, reactive } from 'vue'
import { NueMessage } from 'nue-ui'
import { TagHandler } from '@/infrastructure/handlers/tasks/tag-handler'
import { IndexViewContext } from '@/views/index/index-view'
import { INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useTagsStore } from '@/stores'
import { storeToRefs } from 'pinia'

const useTagColorUpdater = () => {
    const { tagUseCase, taskUseCase, subscriber, dialogManager } =
        inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!
    const tagsStore = useTagsStore()
    const { tags } = storeToRefs(tagsStore)

    const tagHandler = new TagHandler(taskUseCase, tagUseCase, tagsStore, subscriber)

    const states = reactive({
        tagId: null as string | null,
        color: 'transparent',
        updating: false,
        disabled: false
    })

    const getTagColor = (id: string) => {
        if (!id) {
            NueMessage.error('标签 ID 不能为空')
            return
        }
        states.tagId = id
        const tag = tags.value.find((t) => t.id === id)
        states.color = tag?.color || 'transparent'
    }

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

    return { states, dialogManager, getTagColor, updateTagColor }
}

export default useTagColorUpdater
