import { PomodoroDomain } from '@nao-todo/domain/pomodoro'
import { newPomodoroRecordRepository, newPomodoroRepository, PomodoroRepoImpl } from '@nao-todo/infrastructure/backend/pomodoro'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

/**
 * Pomodoro 用例
 */
export class PomodoroUseCase {
    /**
     * Pomodoro 用例构造函数
     * @param pomodoroDomain Pomodoro 业务逻辑层
     * @param pomodoroRepo Pomodoro 数据访问层
     */
    constructor(
        private pomodoroDomain: PomodoroDomain,
        private pomodoroRepo: PomodoroRepoImpl
        // private pomodoroStore: PomodoroStore,
    ) {}
}

export const newPomodoroUseCase = (
    // store: PomodoroStore
) => {
    const requester = getRequesterImpl()
    const pomodoroRepo = newPomodoroRepository(requester)
    const pomodoroRecordRepo = newPomodoroRecordRepository(requester)
    const domain = new PomodoroDomain(pomodoroRepo, pomodoroRecordRepo)
    return new PomodoroUseCase(domain, pomodoroRepo)
}