import { defineAsyncComponent } from 'vue'
import DetailsEmpty from './details-empty.vue'
import DetailsLoading from './details-loading.vue'
import DetailsRow from './details-row.vue'
import DetailsHeader from './details-header.vue'
import DetailsMain from './details-main.vue'
import DetailsMainComments from './details-main-comments.vue'
import DetailsMainEvents from './details-main-events.vue'
import DetailsFooter from './details-footer.vue'

export {
    DetailsEmpty,
    DetailsHeader,
    DetailsLoading,
    DetailsRow,
    DetailsMain,
    DetailsFooter,
    DetailsMainComments,
    DetailsMainEvents
}

export const TasksDetails = defineAsyncComponent({
    loader: () => import('./details.vue')
})

export const TasksFloatDetails = defineAsyncComponent({
    loader: () => import('./float-details.vue')
})
