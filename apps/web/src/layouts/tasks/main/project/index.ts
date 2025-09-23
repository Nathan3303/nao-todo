import { defineAsyncComponent } from 'vue'
import { ErrorComponent, LoadingComponent } from '@/components/tasks'

export const ProjectViewHeader = defineAsyncComponent({
    loader: () => import('./header.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
})

export const ProjectViewTable = defineAsyncComponent({
    loader: () => import('./table.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
})

export const ProjectViewKanban = defineAsyncComponent({
    loader: () => import('./kanban.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
})
