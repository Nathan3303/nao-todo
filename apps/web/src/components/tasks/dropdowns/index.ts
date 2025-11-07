import { defineAsyncComponent } from 'vue'
import TasksDropdownDivBlock from '@/components/ui/div-block.vue'
// import TasksOperationsDropdown from './operations-dropdown.vue'

// 基本视图操作下拉菜单
const TasksBasicViewOperationsDropdown = defineAsyncComponent(
    () => import('./basic-view-operations.vue')
)
// 项目视图操作下拉菜单
const TasksProjectViewOperationsDropdown = defineAsyncComponent(
    () => import('./project-view-operations.vue')
)
// 标签视图操作下拉菜单
const TasksTagViewOperationsDropdown = defineAsyncComponent(
    () => import('./tag-view-operations.vue')
)

// 待办事项筛选下拉菜单
const TasksTodoFilterDropdown = defineAsyncComponent(() => import('./todo-filter.vue'))

export {
    TasksDropdownDivBlock,
    // TasksOperationsDropdown,
    TasksBasicViewOperationsDropdown,
    TasksProjectViewOperationsDropdown,
    TasksTagViewOperationsDropdown,
    TasksTodoFilterDropdown
}

