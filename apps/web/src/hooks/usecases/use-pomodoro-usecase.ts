import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import type { PomodoroStore } from '@nao-todo/domain-pomodoro'
import { PomodoroUseCase } from '@nao-todo/domain-pomodoro'
import { useCaseBinding } from '@/hooks/usecases/binding'

/**
 * 番茄钟用例
 * @param store 番茄钟状态
 * @returns 番茄钟用例
 */
export const usePomodoroUseCase = (store: PomodoroStore) => {
    const pomodoroRepo = useCaseBinding.createPomodoroRepository()
    const pomodoroRecordRepo = useCaseBinding.createPomodoroRecordRepository()
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    const useCase = new PomodoroUseCase(domain, pomodoroRepo, store)
    // C-59 / AC10：web 离线只读闸门经 binding 注入（web-only）
    return useCaseBinding.decorateUseCase?.(useCase, 'pomodoro') ?? useCase
}