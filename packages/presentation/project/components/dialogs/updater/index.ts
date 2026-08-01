import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent({
    loader: () => import('./project-updater.vue'),
    delay: 0,
    timeout: 10000
})