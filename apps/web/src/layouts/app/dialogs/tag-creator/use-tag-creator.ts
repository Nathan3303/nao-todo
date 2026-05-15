import { inject, ref, watch } from 'vue'
import { TagHandler } from '@/infrastructure/handlers/tasks/tag-handler'
import { IndexViewContext } from '@/views/index/index-view'
import { INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useTagsStore } from '@/stores'

const useTagCreator = () => {
    const { tagUseCase, taskUseCase, subscriber, dialogManager } =
        inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!
    const tagsStore = useTagsStore()

    const tagHandler = new TagHandler(taskUseCase, tagUseCase, tagsStore, subscriber)

    const states = ref({
        name: '',
        description: '',
        color: '',
        isNameEmpty: false,
        creating: false
    })

    const clearInputsValue = () => {
        states.value = {
            name: '',
            description: '',
            color: '',
            isNameEmpty: false,
            creating: false
        }
    }

    const handleConfirm = async (): Promise<boolean> => {
        if (!states.value.name) {
            states.value.isNameEmpty = true
            return false
        }
        states.value.creating = true
        const err = await tagHandler.createTag({
            name: states.value.name,
            description: states.value.description,
            color: states.value.color
        })
        states.value.creating = false
        if (err) return false
        return true
    }

    watch(
        () => states.value.name,
        (newVal) => newVal && (states.value.isNameEmpty = !newVal)
    )

    return { states, dialogManager, handleConfirm, clearInputsValue }
}

export default useTagCreator
