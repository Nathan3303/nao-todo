import { defineAsyncComponent } from 'vue'
// import TodoKanban from './kanban.vue'

// export { TodoKanban }
export const TodoKanban = defineAsyncComponent(() => import('./kanban.vue'))
