import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import { PomodoroRecordUseCase } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordStore } from '@nao-todo/domain-pomodoro'
import {
    newLocalPomodoroRecordRepository,
    newLocalPomodoroRepository
} from '@nao-todo/infrastructure'

/**
 * 番茄钟记录用例（桌面版本地仓储）
 */
export const usePomodoroRecordUseCase = (store: PomodoroRecordStore) => {
    const pomodoroRepo = newLocalPomodoroRepository()
    const pomodoroRecordRepo = newLocalPomodoroRecordRepository()
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroRecordUseCase(domain, pomodoroRecordRepo, store)
}