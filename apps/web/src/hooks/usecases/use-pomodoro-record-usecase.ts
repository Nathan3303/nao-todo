import { PomodoroDomain } from '@nao-todo/domain-pomodoro'
import { PomodoroRecordUseCase } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordStore } from '@nao-todo/domain-pomodoro'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const usePomodoroRecordUseCase = (store: PomodoroRecordStore) => {
    const pomodoroRepo = useCaseBinding.createPomodoroRepository()
    const pomodoroRecordRepo = useCaseBinding.createPomodoroRecordRepository()
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    const useCase = new PomodoroRecordUseCase(domain, pomodoroRecordRepo, store)
    // 阶段二 2A / W4：番茄记录域已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M5）
    // （钩子仍保留给身份域；desktop binding 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'pomodoro-record') ?? useCase
}