import useTaskDomain from './services/task'
import useTaskInMemoryDomain from './services/task-in-memory'
import { TaskEntity } from './entities'
import type { TaskRepository } from './repositories/task'
import type { TaskInMemoryRepository } from './repositories/task-in-memory'

export { useTaskDomain, useTaskInMemoryDomain, TaskEntity }
export type { TaskRepository, TaskInMemoryRepository }
