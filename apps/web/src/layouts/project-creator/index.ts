import CreateDialog from './create-project-dialog.vue'
import { defineAsyncComponent } from 'vue'

export const CreateProjectDialog = CreateDialog

export const AsyncCreateProjectDialog = defineAsyncComponent(async () => {
    return await import('./create-project-dialog.vue')
})
