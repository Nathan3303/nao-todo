import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import { PomodoroRecordUseCase } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordStore } from '@nao-todo/domain-pomodoro'
import { newPomodoroRecordRepository, newPomodoroRepository } from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

export const usePomodoroRecordUseCase = (store: PomodoroRecordStore) => {
    const requester = getRequesterImpl()
    const pomodoroRepo = newPomodoroRepository(requester)
    const pomodoroRecordRepo = newPomodoroRecordRepository(requester)
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroRecordUseCase(domain, pomodoroRecordRepo, store)
}