import { defineAsyncComponent } from 'vue'

export const ProjectCreator = defineAsyncComponent({
    loader: () => import('./project-creator.vue')
})
