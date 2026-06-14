import { registry } from '../trigger-registry'
import { tagHandler } from './tag-handler'
import { projectHandler } from './project-handler'
import { priorityHandler } from './priority-handler'
import { stateHandler } from './state-handler'

registry.register(tagHandler)
registry.register(projectHandler)
registry.register(priorityHandler)
registry.register(stateHandler)

export { registry }
