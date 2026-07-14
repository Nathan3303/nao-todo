import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent({
    loader: () => import('./tag-color-updater.vue'),
    delay: 0,
    timeout: 10000
})
