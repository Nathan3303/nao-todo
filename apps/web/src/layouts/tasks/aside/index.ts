import { defineAsyncComponent } from 'vue'
import TasksAside from './index.vue'
import { Loading as LoadingComponent } from '@nao-todo/components'

// export default TasksAside
export default defineAsyncComponent({
    loader: () => Promise.resolve(TasksAside),
    loadingComponent: LoadingComponent,
    delay: 1000,
})

