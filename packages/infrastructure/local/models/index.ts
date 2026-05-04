/**
 * IndexedDB 模型基类
 * @description 定义了 IndexedDB 模型的基类，用于存储和检索数据。
 */

import type { UserModel, UserConfigModel } from './user'
import type { ProjectModel, ProjectPreferenceModel } from './project'
import type { TagModel, TagPreferenceModel } from './tag'
import type { TaskModel } from './task'
import type { EventModel } from './event'
import type { CommentModel } from './comment'

export type {
    UserModel,
    UserConfigModel,
    ProjectModel,
    ProjectPreferenceModel,
    TagModel,
    TagPreferenceModel,
    TaskModel,
    EventModel,
    CommentModel
}

