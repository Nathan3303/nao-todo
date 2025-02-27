import { defineAsyncComponent } from 'vue'

export const TasksOperationsDropdown = defineAsyncComponent({
    loader: () => import('./operations-dropdown.vue'),
    delay: 0,
    timeout: 3000,
    suspensible: false
})

export const TasksFilterDropdown = defineAsyncComponent({
    loader: () => import('./filter-dropdown.vue'),
    delay: 0,
    timeout: 3000,
    suspensible: false
})
