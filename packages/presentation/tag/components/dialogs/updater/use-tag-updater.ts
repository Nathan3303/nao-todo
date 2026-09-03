import { NueMessage } from 'nue-ui'
import { computed, ref } from 'vue'
import { TagHandler } from '../../../handlers'
import { useTagsStore } from '../../../stores'
import type { TagUpdaterDialogProps } from './types'

const useTagUpdater = (props: TagUpdaterDialogProps) => {
    const { tagUseCase, subscriber } = props
    const tagsStore = useTagsStore()
    const tagHandler = new TagHandler(tagUseCase, tagsStore, subscriber)

    const states = ref({
        tagId: null as string | null,
        name: '',
        description: '',
        color: 'transparent',
        updating: false,
        disabled: false
    })

    const formData = computed({
        get: () => ({
            name: states.value.name,
            description: states.value.description
        }),
        set: (val) => {
            states.value.name = val.name
            states.value.description = val.description
        }
    })

    const getTag = (id: string) => {
        const tag = tagsStore.getTag(id)
        if (!tag) {
            NueMessage.error('未找到标签')
            return false
        }
        states.value.tagId = id
        states.value.name = tag.name || ''
        states.value.description = tag.description || ''
        states.value.color = tag.color || 'transparent'
        return true
    }

    const updateTag = async (): Promise<boolean> => {
        if (!states.value.tagId) {
            NueMessage.error('标签 ID 不能为空')
            return false
        }
        if (!states.value.name) {
            NueMessage.error('标签名称不能为空')
            return false
        }
        states.value.disabled = states.value.updating = true
        const err = await tagHandler.updateTag(states.value.tagId, {
            name: states.value.name,
            description: states.value.description,
            color: states.value.color
        })
        states.value.updating = false
        if (err !== null) {
            states.value.disabled = false
            return false
        }
        return true
    }

    const resetStates = () => {
        states.value.tagId = null
        states.value.name = ''
        states.value.description = ''
        states.value.color = 'transparent'
        states.value.updating = false
        states.value.disabled = false
    }

    return { states, formData, getTag, updateTag, resetStates }
}

export default useTagUpdater