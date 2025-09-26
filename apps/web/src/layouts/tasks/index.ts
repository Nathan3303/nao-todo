// aside
import TasksAside from './aside/tasks-aside.vue'
import TasksAsideDrawer from './aside/tasks-aside-drawer.vue'

// main
import TasksMain from './main/tasks-main.vue'
import TasksMainHeader from './main/tasks-main-header.vue'

// outline
import TasksTodoDetails from './outlines/details/details.vue'
import TasksTodoDetailsDrawer from './outlines/details/float-details.vue'

// export
export {
    // aside
    TasksAside,
    TasksAsideDrawer,

    // main
    TasksMain,
    TasksMainHeader,

    // outline
    TasksTodoDetails,
    TasksTodoDetailsDrawer
}
export type * from './types'
export * from './utils'
export * from './constants'
