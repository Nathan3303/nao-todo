import { defineAsyncComponent } from 'vue'
// import Form from './form.vue'

// export const SettingsPasswordForm = Form
export const SettingsPasswordForm = defineAsyncComponent(() => import('./form.vue'))