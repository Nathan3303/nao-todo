import { computed, reactive, ref } from 'vue'
import { TagHandler } from '../../../handlers'
import { useTagsStore } from '../../../stores'
import { storeToRefs } from 'pinia'
import { TAG_CREATOR_DIALOG_KEY, TAG_COLOR_UPDATER_DIALOG_KEY } from '@nao-todo/shared'
import type { TagManagerDialogProps } from './types'

const useTagManager = (props: TagManagerDialogProps) => {
    const { dialogManager, subscriber, tagUseCase } = props
    const tagsStore = useTagsStore()
    const { tags } = storeToRefs(tagsStore)
    const tagHandler = new TagHandler(tagUseCase, tagsStore, subscriber)

    const loadingTags = ref<Map<string, boolean>>(new Map())
    const states = reactive({ filterInfo: { name: '' } })

    const filteredTags = computed(() => {
        return tags.value.filter((tag) => {
            if (states.filterInfo.name === '') return true
            return tag.name.includes(states.filterInfo.name)
        })
    })

    const openTagCreator = () => {
        dialogManager.open(TAG_CREATOR_DIALOG_KEY)
    }

    const openTagColorUpdater = (tagId: string) => {
        dialogManager.open(TAG_COLOR_UPDATER_DIALOG_KEY, tagId)
    }

    const deleteTag = (tagId: string) => {
        loadingTags.value.set(tagId, true)
        tagHandler.deleteTag(tagId).finally(() => {
            loadingTags.value.set(tagId, false)
        })
    }

    return {
        states,
        filteredTags,
        loadingTags,
        openTagCreator,
        openTagColorUpdater,
        deleteTag
    }
}

export default useTagManager
