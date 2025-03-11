import { defineAsyncComponent } from 'vue'

export const TagCreator = defineAsyncComponent({
    loader: () => import('./tag-creator.vue')
})
