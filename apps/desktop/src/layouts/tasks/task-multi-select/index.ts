import { defineAsyncComponent } from 'vue'

export const TaskMultiSelect = defineAsyncComponent({
    loader: () => import('./multi-details.vue')
})
