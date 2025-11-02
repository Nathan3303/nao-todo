import { defineAsyncComponent } from 'vue'
import TasksAside from './index.vue'
import { Loading as LoadingComponent } from '@/components/ui'

// export default TasksAside
export default defineAsyncComponent({
    loader: () => Promise.resolve(TasksAside),
    loadingComponent: LoadingComponent,
    delay: 1000,
})

