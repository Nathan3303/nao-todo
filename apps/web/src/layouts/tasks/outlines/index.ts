import { defineAsyncComponent } from 'vue'
// import TasksOutline from './index.vue'

export default defineAsyncComponent(() => import('./index.vue'))
// export default TasksOutline

