import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent({
    loader: () => import('./creator.vue'),
    delay: 0,
    timeout: 10000
})