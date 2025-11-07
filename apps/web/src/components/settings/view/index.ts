// import Floating from './floating.vue'
// import LandingPage from './landing-page.vue'

// export const SettingsViewFloating = Floating
// export const SettingsViewLandingPage = LandingPage

import { defineAsyncComponent } from 'vue'

export const SettingsViewFloating = defineAsyncComponent(() => import('./floating.vue'))
export const SettingsViewLandingPage = defineAsyncComponent(() => import('./landing-page.vue'))

