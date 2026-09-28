/**
 * 冲突 diff 字段名 → 用户可读标签（T340 · C 端化）
 *
 * @description 面向用户的界面**不得**裸露技术键名（`name`/`archivedAt`/`revision`…）⇒
 *              已知字段一律映射到 i18n 标签；未映射字段走 `humanizeField` **可读回退**
 *              （拆词 + 首字母大写，非 raw camelCase）。
 *              新增字段接入方式：在 `FIELD_LABEL_KEYS` 增一行 + 在 `packages/shared/locales/{types,zh-CN,en-US}`
 *              增对应字段标签键（三处齐备；键集合由死键守护覆盖）。
 */
import { t, type LocaleKey } from '@nao-todo/shared/locales'

/** 已知字段 → i18n 键（缺失 ⇒ 走 `humanizeField` 回退） */
export const FIELD_LABEL_KEYS: Record<string, LocaleKey> = {
    id: 'sync.conflict.field.id',
    userId: 'sync.conflict.field.userId',
    createdAt: 'sync.conflict.field.createdAt',
    updatedAt: 'sync.conflict.field.updatedAt',
    deletedAt: 'sync.conflict.field.deletedAt',
    revision: 'sync.conflict.field.revision',
    syncedServerUpdatedAt: 'sync.conflict.field.syncedServerUpdatedAt',
    parentTaskId: 'sync.conflict.field.parentTaskId',
    name: 'sync.conflict.field.name',
    description: 'sync.conflict.field.description',
    state: 'sync.conflict.field.state',
    priority: 'sync.conflict.field.priority',
    startAt: 'sync.conflict.field.startAt',
    endAt: 'sync.conflict.field.endAt',
    projectId: 'sync.conflict.field.projectId',
    tags: 'sync.conflict.field.tags',
    archivedAt: 'sync.conflict.field.archivedAt',
    starMarkAt: 'sync.conflict.field.starMarkAt',
    givenUpAt: 'sync.conflict.field.givenUpAt',
    remindAt: 'sync.conflict.field.remindAt',
    remindRepeat: 'sync.conflict.field.remindRepeat',
    remindTime: 'sync.conflict.field.remindTime',
    remindWeekdays: 'sync.conflict.field.remindWeekdays',
    checkItemCount: 'sync.conflict.field.checkItemCount',
    commentCount: 'sync.conflict.field.commentCount',
    subtaskCount: 'sync.conflict.field.subtaskCount',
    sortId: 'sync.conflict.field.sortId',
    taskId: 'sync.conflict.field.taskId',
    taskName: 'sync.conflict.field.taskName',
    isDone: 'sync.conflict.field.isDone',
    icon: 'sync.conflict.field.icon',
    color: 'sync.conflict.field.color',
    deactivedAt: 'sync.conflict.field.deactivedAt',
    taskCount: 'sync.conflict.field.taskCount',
    content: 'sync.conflict.field.content',
    attachments: 'sync.conflict.field.attachments',
    isTopUp: 'sync.conflict.field.isTopUp',
    avatar: 'sync.conflict.field.avatar',
    nickname: 'sync.conflict.field.nickname',
    type: 'sync.conflict.field.type',
    duration: 'sync.conflict.field.duration',
    totalDuration: 'sync.conflict.field.totalDuration',
    sessionId: 'sync.conflict.field.sessionId',
    pomodoroId: 'sync.conflict.field.pomodoroId',
    note: 'sync.conflict.field.note'
}

/** 未映射字段的可读回退：下划线/中划线 → 空格；camelCase 拆词；首字母大写 */
export const humanizeField = (field: string): string => {
    const spaced = field
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim()
    return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : field
}

/** 字段名 → 面向用户的标签（已知 ⇒ i18n；未知 ⇒ 可读回退） */
export const fieldLabel = (field: string): string => {
    const key = FIELD_LABEL_KEYS[field]
    return key ? t(key) : humanizeField(field)
}