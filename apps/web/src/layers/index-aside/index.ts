// import Aside from './index-aside.vue'
//
// export const IndexAside = Aside

import { defineAsyncComponent } from 'vue'

export const IndexAside = defineAsyncComponent(async () => {
    return await import('./index-aside.vue')
})
