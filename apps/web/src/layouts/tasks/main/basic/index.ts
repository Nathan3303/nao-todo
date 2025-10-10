import { defineAsyncComponent } from 'vue'
import { ErrorComponent, LoadingComponent } from '@/components/tasks'

export const BasicViewHeader = defineAsyncComponent({
    loader: () => import('./header.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
})

export const BasicViewTable = defineAsyncComponent({
    loader: () => import('./table.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
})

export const BasicViewKanban = defineAsyncComponent({
    loader: () => import('./kanban.vue'),
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
})

// import BasicViewHeader from './header.vue'
// import BasicViewTable from './table.vue'
// import BasicViewKanban from './kanban.vue'

// export { BasicViewHeader, BasicViewTable, BasicViewKanban }
