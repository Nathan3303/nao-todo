import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import { PomodoroRecordUseCase } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordStore } from '@nao-todo/domain-pomodoro'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const usePomodoroRecordUseCase = (store: PomodoroRecordStore) => {
    const pomodoroRepo = useCaseBinding.createPomodoroRepository()
    const pomodoroRecordRepo = useCaseBinding.createPomodoroRecordRepository()
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    const useCase = new PomodoroRecordUseCase(domain, pomodoroRecordRepo, store)
    // C-59 / AC10：web 离线只读闸门经 binding 注入（web-only；#19 番茄结束落库经 createRecord）
    return useCaseBinding.decorateUseCase?.(useCase, 'pomodoro-record') ?? useCase
}