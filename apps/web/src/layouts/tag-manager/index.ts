import { defineAsyncComponent } from 'vue'
// import TagManager from './tag-manager.vue'

// export const NaoTagManager = TagManager
export const AsyncNaoTagManager = defineAsyncComponent(async () => {
    return await import('./tag-manager.vue')
})
