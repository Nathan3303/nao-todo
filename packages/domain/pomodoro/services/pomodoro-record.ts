import { PomodoroRecordEntity } from '../entities'
import { CreatePomodoroRecordValueObject } from '../valueobjects'
import { unwrapError } from '@nao-todo/infrastructure/utils'
import parseObject2QueryString from '@nao-todo/infrastructure/utils/query-string-parser'
import type { PomodoroRecordRepository } from '../repositories'
import type { GoAsync, GetPomodoroRecordsOptions, ResponseDataPagination } from '@nao-todo/types'

/**
 * Pomodoro 记录领域服务
 * @description 处理 Pomodoro 记录的业务逻辑
 */
export class PomodoroRecordDomain {
    constructor(private repo: PomodoroRecordRepository) {}

    /**
     * 创建 Pomodoro 记录
     * @param valueObject 创建记录值对象
     * @returns Pomodoro 记录实体
     */
    async create(valueObject: CreatePomodoroRecordValueObject): GoAsync<PomodoroRecordEntity> {
        const validateErr = valueObject.validate()
        if (validateErr !== null) {
            console.log(unwrapError(validateErr))
            return [null, validateErr]
        }
        return await this.repo.create(valueObject)
    }

    /**
     * 获取 Pomodoro 记录列表
     * @param listOptions 查询选项
     * @returns Pomodoro 记录实体列表和分页信息
     */
    async list(
        listOptions?: GetPomodoroRecordsOptions
    ): GoAsync<{ entities: PomodoroRecordEntity[]; pagination?: ResponseDataPagination }> {
        // 1. 转换查询选项 -> 查询字符串
        const queryString = parseObject2QueryString<GetPomodoroRecordsOptions>(
            listOptions || {}
        )
        // 2. 调用仓库方法
        return await this.repo.list(queryString)
    }
}
