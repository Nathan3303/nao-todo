import type {
    TaskViewObject,
    TaskProjectViewObject,
    TaskTagViewObject
} from '@nao-todo/domain-task'

// 任务详情面板视图对象
export type TaskDetailsViewObject = TaskViewObject & {
    id: TaskViewObject['id']
    projectName?: TaskProjectViewObject['name']
    tagList: TaskTagViewObject[]
    isDone: boolean
}

// 任务详情面板属性
export type TaskDetailsProps = {
    taskId?: TaskViewObject['id']
}