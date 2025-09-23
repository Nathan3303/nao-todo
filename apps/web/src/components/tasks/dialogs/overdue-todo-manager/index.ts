import { defineAsyncComponent } from 'vue'
import LoadingComponent from '@/components/ui/dialog-manager/loading.vue'
import ErrorComponent from '@/components/ui/dialog-manager/error.vue'

export default defineAsyncComponent({
    loader: () => import('./overdue-todo-manager.vue'),
    loadingComponent: LoadingComponent,
    delay: 0,
    errorComponent: ErrorComponent,
    timeout: 10000
})
