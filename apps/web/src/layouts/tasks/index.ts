// Aside
import TasksViewAside from './aside/aside.vue'
import TasksViewFloatAside from './aside/float-aside.vue'
import TasksViewAsideAdapter from './aside/index.vue'
// Dialogs
import TasksViewDialogs from './dialogs/index.vue'
// Built-in project
import TasksViewBuiltInProjectView from './built-in-project/index.vue'
// Task details
import { TaskDetails, TaskDetailsDrawer } from './task-details'
import TasksViewDetailsAdapter from './task-details/index.vue'

export {
    // Aside
    TasksViewAside,
    TasksViewFloatAside,
    TasksViewAsideAdapter,
    // Dialogs
    TasksViewDialogs,
    // Built-in project
    TasksViewBuiltInProjectView,
    // Task details
    TaskDetails as TasksViewDetails,
    TaskDetailsDrawer as TasksViewFloatDetails,
    TasksViewDetailsAdapter,
}
