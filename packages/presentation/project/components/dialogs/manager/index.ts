import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent({
    loader: () => import('./project-manager.vue'),
    delay: 0,
    timeout: 10000
})