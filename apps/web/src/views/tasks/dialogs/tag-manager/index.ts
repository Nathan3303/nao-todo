import { defineAsyncComponent } from 'vue'

export const TagManager = defineAsyncComponent({
    loader: () => import('./tag-manager.vue')
})
