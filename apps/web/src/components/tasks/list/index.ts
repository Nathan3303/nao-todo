import { defineAsyncComponent } from 'vue'
// import List from './list.vue'

export const TodoList = defineAsyncComponent(() => import('./list.vue'))
export type * from './types'
