/**
 * Pomodoro 记录实体
 * @description 表示一条专注记录的业务实体
 */
export class PomodoroRecordEntity {
    constructor(
        public id: string,
        public sessionId: string,
        public type: number,
        public taskId: string,
        public taskName: string,
        public description: string,
        public startAt: string,
        public endAt: string,
        public duration: number,
        public note: string,
        public createdAt: string,
        public updatedAt: string,
        public deletedAt: string | null
    ) {}
}
