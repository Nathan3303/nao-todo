import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import type { PomodoroStore } from '@nao-todo/domain-pomodoro'
import { PomodoroUseCase } from '@nao-todo/domain-pomodoro'
import {
    newLocalPomodoroRecordRepository,
    newLocalPomodoroRepository
} from '@nao-todo/infrastructure'

/**
 * 番茄钟用例（桌面版本地仓储）
 */
export const usePomodoroUseCase = (store: PomodoroStore) => {
    const pomodoroRepo = newLocalPomodoroRepository()
    const pomodoroRecordRepo = newLocalPomodoroRecordRepository()
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroUseCase(domain, pomodoroRepo, store)
}