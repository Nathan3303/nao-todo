import { computed, reactive } from 'vue'
import type { TagManagerVO, TagManagerEmits, TagManagerProps } from './type'
import type { Tag } from '@nao-todo/types'

const useTagManager = (props: TagManagerProps, emit: TagManagerEmits) => {
    // @states
    const states = reactive<TagManagerVO>({
        filterInfo: {
            name: ''
        }
    })

    // @computed 筛选标签
    const filteredTags = computed(() => {
        return props.tags.filter((tag) => {
            if (states.filterInfo.name === '') return true
            return tag.name.includes(states.filterInfo.name)
        })
    })

    // @method Emit proxy
    const deleteTag = (tagId: Tag['id']) => emit('deleteTag', tagId)

    // @returns
    return {
        states,
        filteredTags,
        deleteTag,
    }
}

export default useTagManager
