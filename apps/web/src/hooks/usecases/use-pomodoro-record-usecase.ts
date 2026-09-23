import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import { PomodoroRecordUseCase } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordStore } from '@nao-todo/domain-pomodoro'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const usePomodoroRecordUseCase = (store: PomodoroRecordStore) => {
    const pomodoroRepo = useCaseBinding.createPomodoroRepository()
    const pomodoroRecordRepo = useCaseBinding.createPomodoroRecordRepository()
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroRecordUseCase(domain, pomodoroRecordRepo, store)
}