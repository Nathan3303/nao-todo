import { defineAsyncComponent } from 'vue'

const OfflineScreen = defineAsyncComponent(() => import('./offline-screen.vue'))

export { OfflineScreen }

