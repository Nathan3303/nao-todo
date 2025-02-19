// import TodoMultiDetails from './multi-details.vue'
//
// export { TodoMultiDetails }
export type * from './types'

import { defineAsyncComponent } from 'vue'

export const TodoMultiDetails = defineAsyncComponent(async () => {
    return await import('./multi-details.vue')
})
