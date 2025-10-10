// import { defineAsyncComponent } from 'vue'
// import { ErrorComponent, LoadingComponent } from '@/components/tasks'

// export const TagViewHeader = defineAsyncComponent({
//     loader: () => import('./header.vue'),
//     loadingComponent: LoadingComponent,
//     errorComponent: ErrorComponent
// })

// export const TagViewTable = defineAsyncComponent({
//     loader: () => import('./table.vue'),
//     loadingComponent: LoadingComponent,
//     errorComponent: ErrorComponent
// })

// export const TagViewKanban = defineAsyncComponent({
//     loader: () => import('./kanban.vue'),
//     loadingComponent: LoadingComponent,
//     errorComponent: ErrorComponent
// })

import TagViewHeader from './header.vue'
import TagViewTable from './table.vue'
import TagViewKanban from './kanban.vue'

export { TagViewHeader, TagViewTable, TagViewKanban }
