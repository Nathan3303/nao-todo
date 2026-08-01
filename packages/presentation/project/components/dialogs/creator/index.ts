import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent({
    loader: () => import('./index.vue'),
    delay: 1000
})