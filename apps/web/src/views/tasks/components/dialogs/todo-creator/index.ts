import { defineAsyncComponent } from 'vue'

export const TodoCreator = defineAsyncComponent({
    loader: () => import('./todo-creator.vue')
})
