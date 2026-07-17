import type { TaskViewObject, TaskProjectViewObject, TaskTagViewObject } from '../../types'

// 任务详情面板视图对象
export type TaskDetailsViewObject = TaskViewObject & {
    projectName?: TaskProjectViewObject['name']
    tagList: TaskTagViewObject[]
    isDone: boolean
}

// 任务详情面板属性
export type TaskDetailsProps = {
    taskId?: TaskViewObject['id']
}
