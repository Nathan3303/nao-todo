export const TaskStateSelectOptions = [
    { label: '代办', value: 'todo', icon: 'circle' },
    { label: '正在进行', value: 'in-progress', icon: 'in-progress' },
    { label: '已完成', value: 'done', icon: 'success' }
]

export const TaskPrioritySelectOptions = [
    { label: '低优先级', value: 'low', icon: 'priority-1' },
    { label: '中优先级', value: 'medium', icon: 'priority-2' },
    { label: '高优先级', value: 'high', icon: 'priority-3' }
]

export const columnLabels: Record<string, string> = {
    id: 'ID',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    deletedAt: '删除时间',
    userId: '所属用户 ID',
    projectId: '所属清单 ID',
    name: '名称',
    description: '描述',
    state: '状态',
    priority: '优先级',
    startAt: '起始日期',
    endAt: '截止日期',
    project: '所属清单',
    tags: '标签',
    archivedAt: '归档时间',
    isDeleted: '是否删除',
    isArchived: '是否归档',
    isFavorited: '是否收藏',
    isGivenUp: '是否放弃'
}
