import { defineAsyncComponent } from 'vue'
// import ProjectManager from './project-manager.vue'

// export const NaoProjectManager = ProjectManager
export const AsyncNaoProjectManager = defineAsyncComponent(async () => {
    return await import('./project-manager.vue')
})
