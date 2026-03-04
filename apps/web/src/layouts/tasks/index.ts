// Aside
import { Aside, FloatAside, AsideAdapter } from './aside'
// Dialogs
import TasksViewDialogs from './dialogs/index.vue'
// Built-in project
import { BuiltInProjectSection } from './built-in-project'
// Task details
import { TaskDetails, TaskDetailsDrawer } from './task-details'
import TasksViewDetailsAdapter from './task-details/index.vue'

export {
    // Aside
    Aside as TasksViewAside,
    FloatAside as TasksViewFloatAside,
    AsideAdapter as TasksViewAsideAdapter,
    // Built-in project
    BuiltInProjectSection as TasksViewBuiltInProjectSection,
    // Dialogs
    TasksViewDialogs,
    // Task details
    TaskDetails as TasksViewDetails,
    TaskDetailsDrawer as TasksViewFloatDetails,
    TasksViewDetailsAdapter
}
