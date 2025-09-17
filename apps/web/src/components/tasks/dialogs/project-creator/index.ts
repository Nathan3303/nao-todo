import { defineAsyncComponent } from 'vue'
import LoadingComponent from '@/components/tasks/dialogs/loading.vue'
import ErrorComponent from '@/components/tasks/dialogs/error.vue'

export default defineAsyncComponent({
    loader: () => import('./project-creator.vue'),
    loadingComponent: LoadingComponent,
    delay: 0,
    errorComponent: ErrorComponent,
    timeout: 10000
})
