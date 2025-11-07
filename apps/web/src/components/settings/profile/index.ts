import { defineAsyncComponent } from 'vue'
// import Avatar from './avatar.vue'
// import Info from './info.vue'
// import Nickname from './nickname.vue'

export const SettingsProfileAvatar = defineAsyncComponent(() => import('./avatar.vue'))
export const SettingsProfileInfo = defineAsyncComponent(() => import('./info.vue'))
export const SettingsProfileNickname = defineAsyncComponent(() => import('./nickname.vue'))

