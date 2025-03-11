import { defineAsyncComponent } from 'vue'
import Aside from './aside.vue'

export const TasksAside = Aside
export const TasksFloatAside = defineAsyncComponent({
    loader: () => import('./float-aside.vue'),
    delay: 0
})
