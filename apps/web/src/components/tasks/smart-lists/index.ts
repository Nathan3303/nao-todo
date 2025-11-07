import { defineAsyncComponent } from 'vue'

const FilterSmartList = defineAsyncComponent(() => import('./filter-smart-list.vue'))
const ProjectSmartList = defineAsyncComponent(() => import('./project-smart-list.vue'))
const TagSmartList = defineAsyncComponent(() => import('./tag-smart-list.vue'))

export { FilterSmartList, ProjectSmartList, TagSmartList }

