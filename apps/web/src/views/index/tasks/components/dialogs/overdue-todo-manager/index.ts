import { defineAsyncComponent } from 'vue'

export const OverdueTodoManager = defineAsyncComponent({
    loader: () => import('./overdue-todo-manager.vue')
})

