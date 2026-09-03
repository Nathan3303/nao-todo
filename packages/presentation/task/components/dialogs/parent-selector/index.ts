import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent({
    loader: () => import('./parent-selector.vue'),
    delay: 0,
    timeout: 10000
})