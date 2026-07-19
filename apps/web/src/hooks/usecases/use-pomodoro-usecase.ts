import { PomodoroDomain, PomodoroStore, PomodoroUseCase } from '@nao-todo/domain/pomodoro'
import {
    newPomodoroRecordRepository,
    newPomodoroRepository
} from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 番茄钟用例
 * @param store 番茄钟状态
 * @returns 番茄钟用例
 */
export const usePomodoroUseCase = (store: PomodoroStore) => {
    const requester = getRequesterImpl()
    const pomodoroRepo = newPomodoroRepository(requester)
    const pomodoroRecordRepo = newPomodoroRecordRepository(requester)
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroUseCase(domain, pomodoroRepo, store)
}

