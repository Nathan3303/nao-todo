import { TaskViewObject } from '@nao-todo/usecases/task'
import { ProjectViewObject } from '@nao-todo/usecases/project'
import { TagViewObject } from '@nao-todo/usecases/tag'

// 任务详情面板视图对象
export type TaskDetailsViewObject = TaskViewObject & {
    projectName?: ProjectViewObject['name']
    tagList: TagViewObject[]
    isDone: boolean
}

// 任务详情面板属性
export type TaskDetailsProps = {
    taskId?: TaskViewObject['id']
}

