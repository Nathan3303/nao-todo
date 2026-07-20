import { PomodoroDomain, PomodoroRecordStore } from '@nao-todo/domain/pomodoro'
import { PomodoroRecordUseCase } from '@nao-todo/application/pomodoro/usecases'
import {
    newPomodoroRecordRepository,
    newPomodoroRepository
} from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * Pom Pomodoro 记录用例工厂函数
 * @param store Pomodoro 记录存储
 * @returns Pomodoro 记录用例
 */
export const usePomodoroRecordUseCase = (store: PomodoroRecordStore) => {
    const requester = getRequesterImpl()
    const pomodoroRepo = newPomodoroRepository(requester)
    const pomodoroRecordRepo = newPomodoroRecordRepository(requester)
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroRecordUseCase(domain, pomodoroRecordRepo, store)
}

