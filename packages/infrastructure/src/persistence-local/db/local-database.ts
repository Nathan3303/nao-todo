import Dexie, { type Table } from 'dexie'
import { resolveUserIdFromStoredJwt } from '../session/local-session'

/**
 * 本地数据库记录类型
 * @description 敏感字段（name/description/content 等）以 AES-GCM 密文（base64 字符串）存储，
 *              结构字段（id/时间戳/状态/外键/排序/userId）明文以保索引与排序。
 *              userId 为数据归属用户（JWT payload 中的雪花 ID 字符串），多用户数据按用户隔离。
 */

export interface ProjectRecord {
    id: string
    userId: string
    name: string
    icon: string
    description: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    archivedAt: string | null
    deactivedAt: string | null
    sortId: number
}

export interface ProjectPreferenceRecord {
    id: string
    userId: string
    projectId: string
    viewType: string
    getTasksOptions: string
    columns: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface TagRecord {
    id: string
    userId: string
    icon: string
    name: string
    description: string
    color: string
    sortId: number
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface TagPreferenceRecord {
    id: string
    userId: string
    tagId: string
    viewType: string
    getTasksOptions: string
    columns: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface TaskRecord {
    id: string
    userId: string
    parentTaskId: string
    name: string
    description: string
    state: string
    priority: string
    startAt: string
    endAt: string
    projectId: string
    tags: string[]
    archivedAt: string | null
    starMarkAt: string | null
    givenUpAt: string | null
    remindAt: string
    remindRepeat: string
    remindTime: string
    remindWeekdays: number[]
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface TaskCheckItemRecord {
    id: string
    userId: string
    taskId: string
    name: string
    isDone: boolean
    sortId: number
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface TaskCommentRecord {
    id: string
    userId: string
    taskId: string
    content: string
    attachments: string[]
    isTopUp: boolean
    avatar: string
    nickname: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface PomodoroRecord {
    id: string
    userId: string
    type: number
    name: string
    description: string | null
    duration: number
    archivedAt: string | null
    totalDuration: number
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface PomodoroRecordItem {
    id: string
    userId: string
    sessionId: string
    pomodoroId: string | null
    type: number
    taskId: string
    taskName: string
    description: string
    startAt: string
    endAt: string
    duration: number
    note: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface UserRecord {
    id: string
    userId: string
    email: string
    nickname: string
    avatar: string
    createdFrom: string
    role: string
    state: number
    deactivedAt: string
    lastRestoreAt: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface UserConfigRecord {
    id: string
    userId: string
    appearance: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface MetaRecord {
    id: string
    salt: string
    iv: string
    wrappedDek: string
}

/**
 * 各业务表名（用于 upgrade 迁移）
 */
const BUSINESS_TABLES = [
    'projects',
    'projectPreferences',
    'tags',
    'tagPreferences',
    'tasks',
    'taskCheckItems',
    'taskComments',
    'pomodoros',
    'pomodoroRecords',
    'users',
    'userConfigs'
] as const

/**
 * NaoTodo 本地数据库
 * @description 业务数据全部走 IndexedDB（dexie），与远程 API 完全解耦。
 *              meta 表存放各用户密钥包（salt + iv + wrappedDek），主键 `${userId}:key-bundle`。
 */
export class NaoTodoLocalDatabase extends Dexie {
    projects!: Table<ProjectRecord, string>
    projectPreferences!: Table<ProjectPreferenceRecord, string>
    tags!: Table<TagRecord, string>
    tagPreferences!: Table<TagPreferenceRecord, string>
    tasks!: Table<TaskRecord, string>
    taskCheckItems!: Table<TaskCheckItemRecord, string>
    taskComments!: Table<TaskCommentRecord, string>
    pomodoros!: Table<PomodoroRecord, string>
    pomodoroRecords!: Table<PomodoroRecordItem, string>
    users!: Table<UserRecord, string>
    userConfigs!: Table<UserConfigRecord, string>
    meta!: Table<MetaRecord, string>

    constructor() {
        super('nao-todo-desktop')
        this.version(1).stores({
            projects: '&id, deletedAt, archivedAt',
            projectPreferences: '&id, projectId',
            tags: '&id, deletedAt',
            tagPreferences: '&id, tagId',
            tasks: '&id, parentTaskId, projectId, state, startAt, endAt, archivedAt, starMarkAt, givenUpAt, remindAt, deletedAt',
            taskCheckItems: '&id, taskId',
            taskComments: '&id, taskId',
            pomodoros: '&id, archivedAt, deletedAt',
            pomodoroRecords: '&id, sessionId, pomodoroId, taskId, startAt, endAt',
            users: '&id',
            userConfigs: '&id',
            meta: '&id'
        })
        // v2：全表增加 userId 字段与索引，实现多用户数据隔离
        this.version(2)
            .stores({
                projects: '&id, userId, deletedAt, archivedAt',
                projectPreferences: '&id, userId, projectId',
                tags: '&id, userId, deletedAt',
                tagPreferences: '&id, userId, tagId',
                tasks: '&id, userId, parentTaskId, projectId, state, startAt, endAt, archivedAt, starMarkAt, givenUpAt, remindAt, deletedAt',
                taskCheckItems: '&id, userId, taskId',
                taskComments: '&id, userId, taskId',
                pomodoros: '&id, userId, archivedAt, deletedAt',
                pomodoroRecords: '&id, userId, sessionId, pomodoroId, taskId, startAt, endAt',
                users: '&id, userId',
                userConfigs: '&id, userId',
                meta: '&id'
            })
            .upgrade(async (tx) => {
                // 旧数据"缺失才补"：已有 userId 的记录不动，缺失的补当前登录用户（无会话则空串占位）
                const userId = resolveUserIdFromStoredJwt() ?? ''
                for (const tableName of BUSINESS_TABLES) {
                    await tx
                        .table(tableName)
                        .toCollection()
                        .modify((rec: Record<string, unknown>) => {
                            if (rec.userId === undefined) rec.userId = userId
                        })
                }
            })
    }
}

/**
 * 本地数据库单例
 */
export const localDatabase = new NaoTodoLocalDatabase()