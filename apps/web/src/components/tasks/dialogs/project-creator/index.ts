import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent({
    loader: () => import('./project-creator.vue'),
    delay: 1000
})

