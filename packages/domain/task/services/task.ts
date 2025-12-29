import { TaskEntity } from '../entities'
import { parseObject2QueryString, type ListTaskOptionsValueObject } from '../valueobjs'
import type { TaskRepository } from '../repositories/task'
import type { CreateTaskVO, GoAsync } from '@nao-todo/types'

export interface TaskDomain {
    get(taskId: string): GoAsync<TaskEntity>
    create(createVO: CreateTaskVO): GoAsync<TaskEntity>
    update(taskId: string, taskEntity: TaskEntity): GoAsync<string>
    remove(taskId: string): GoAsync<void> // like delete
    restore(taskId: string): GoAsync<void>
    list(listOptions?: ListTaskOptionsValueObject): GoAsync<TaskEntity[]>
}

export default (taskRepo: TaskRepository): TaskDomain => {
    // @method 获取任务列表 - 查询选项转换为查询字符串
    const list = async (listOptions?: ListTaskOptionsValueObject): GoAsync<TaskEntity[]> => {
        // 1. 转换查询选项
        const queryString = parseObject2QueryString(listOptions, (key, value) => {
            if (!value) return null
            if (key !== 'sort') return void 0
            const v = value as ListTaskOptionsValueObject['sort']
            if (!v) return null
            if (!v.field) return null
            return `${key}=${v.field}:${v.order}`
        })
        // 2. 调用仓库方法
        return await taskRepo.list(queryString)
    }

    return {
        get: taskRepo.get,
        create: taskRepo.create,
        update: taskRepo.update,
        remove: taskRepo.remove,
        restore: taskRepo.restore,
        list
    }
}
