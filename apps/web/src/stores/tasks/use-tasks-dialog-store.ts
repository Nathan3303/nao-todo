import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
    ProjectCreator,
    ProjectManager,
    TagCreator,
    TagColorUpdater,
    TagManager,
    TodoCreator
} from '@/components/tasks/dialogs'

const useTasksDialogStore = defineStore('TasksDialogStore', () => {
    // @states 对话框 Refs
    const projectCreator = ref<InstanceType<typeof ProjectCreator>>()
    const projectManager = ref<InstanceType<typeof ProjectManager>>()
    const tagCreator = ref<InstanceType<typeof TagCreator>>()
    const tagManager = ref<InstanceType<typeof TagManager>>()
    const tagColorUpdater = ref<InstanceType<typeof TagColorUpdater>>()
    const todoCreator = ref<InstanceType<typeof TodoCreator>>()

    return {
        projectCreator,
        projectManager,
        tagCreator,
        tagManager,
        tagColorUpdater,
        todoCreator
    }
})

export default useTasksDialogStore
