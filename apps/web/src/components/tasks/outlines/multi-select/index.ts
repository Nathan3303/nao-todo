import { defineAsyncComponent } from 'vue'

export const TasksMultiSelect = defineAsyncComponent({
    loader: () => import('./multi-details.vue')
})
