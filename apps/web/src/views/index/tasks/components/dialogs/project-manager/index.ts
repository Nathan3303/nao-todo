import { defineAsyncComponent } from 'vue'

export const ProjectManager = defineAsyncComponent({
    loader: () => import('./project-manager.vue')
})
