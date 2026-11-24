import type { TaskProjectViewObject } from '@nao-todo/domain-task'

export type TaskProjectSelectorProps = {
    projects: TaskProjectViewObject[]
    projectId: TaskProjectViewObject['id']
    placeholder?: string
    placement?: string
    /**
     * 只读（`T795`）：已归档任务等只读场景禁用「移动清单」入口
     * @description 组件 `inheritAttrs: false` ⇒ 必须显式声明并下传（外层传 `:disabled` 才有效）
     * @default false
     */
    disabled?: boolean
}

export type TaskProjectSelectorEmits = {
    (
        event: 'select',
        projectId: TaskProjectViewObject['id'],
        projectTitle?: TaskProjectViewObject['name']
    ): void
}