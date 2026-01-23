import { computed, reactive } from 'vue'
import { useTasksViewStore } from '@/views/index/tasks'
import type { TagManagerVO, TagManagerEmits, TagManagerProps } from './type'
import type { TagVO } from '@nao-todo/types'

const useTagManager = (props: TagManagerProps, emit: TagManagerEmits) => {
    // @store
    const tasksViewStore = useTasksViewStore()

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
    const deleteTag = (tagId: TagVO['id']) => emit('deleteTag', tagId)

    // @methods 对话框
    const showCreateTagDialog = () => tasksViewStore.dialogManager.openDialog('tag-creator')
    const showUpdateTagColorDialog = (tagId: TagVO['id']) =>
        tasksViewStore.dialogManager.openDialog('tag-color-updater', { tagId })

    // @returns
    return {
        states,
        filteredTags,
        deleteTag,
        showCreateTagDialog,
        showUpdateTagColorDialog
    }
}

export default useTagManager
