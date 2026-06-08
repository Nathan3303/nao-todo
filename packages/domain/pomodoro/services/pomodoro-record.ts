import { PomodoroRecordEntity } from '../entities'
import { CreatePomodoroRecordValueObject } from '../valueobjects'
import { unwrapError } from '@nao-todo/infrastructure/utils'
import type { PomodoroRecordRepository } from '../repositories'
import type { GoAsync } from '@nao-todo/types'

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
}
