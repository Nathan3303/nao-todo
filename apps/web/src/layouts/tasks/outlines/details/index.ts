import { defineAsyncComponent } from 'vue'
import DetailsRow from './details-row.vue'
import DetailsHeader from './details-header.vue'
import DetailsMain from './details-main.vue'
import DetailsMainComments from './details-main-comments.vue'
import DetailsMainEvents from './details-main-events.vue'
import DetailsFooter from './details-footer.vue'

export {
    DetailsHeader,
    DetailsMain,
    DetailsFooter,
    DetailsRow,
    DetailsMainComments,
    DetailsMainEvents
}

export const TasksTodoDetails = defineAsyncComponent({
    loader: () => import('./details.vue')
})

export const TasksFloatTodoDetails = defineAsyncComponent({
    loader: () => import('./float-details.vue')
})
