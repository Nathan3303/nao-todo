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
    // 阶段二 2A / W4：番茄域已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M5）
    // （钩子仍保留给身份域；desktop binding 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'pomodoro') ?? useCase
}