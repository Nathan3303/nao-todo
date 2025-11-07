import { defineAsyncComponent } from 'vue'

export const TasksTodoDetails = defineAsyncComponent(() => import('./details.vue'))
export const TasksFloatTodoDetails = defineAsyncComponent(() => import('./float-details.vue'))

