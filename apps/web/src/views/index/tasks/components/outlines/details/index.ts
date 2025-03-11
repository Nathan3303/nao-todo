import { defineAsyncComponent } from 'vue'
import DetailsEmpty from './details-empty.vue'
import DetailsHeader from './details-header.vue'
import DetailsLoading from './details-loading.vue'
import DetailsRow from './details-row.vue'
import DetailsMain from './details-main.vue'
import DetailsFooter from './details-footer.vue'

export { DetailsEmpty, DetailsHeader, DetailsLoading, DetailsRow, DetailsMain, DetailsFooter }
export const TasksDetails = defineAsyncComponent({
    loader: () => import('./details.vue')
})
export const TasksFloatDetails = defineAsyncComponent({
    loader: () => import('./float-details.vue')
})
