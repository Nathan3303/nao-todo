import { defineAsyncComponent } from 'vue'
// import Table from './table.vue'

export const TodoTable = defineAsyncComponent(() => import('./table.vue'))