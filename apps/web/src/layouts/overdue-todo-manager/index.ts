import { defineAsyncComponent } from 'vue'

export const AsyncNaoOverdueTodoManager = defineAsyncComponent(async () => {
    return await import('./overdue-todo-manager.vue')
})
