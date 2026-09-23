// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * 桌面端登录路径装配（AC2）—— signIn 成功后静默完成明文迁移
 *
 * 登录路径已自带明文密码（`ensureUnlocked`）⇒ 升级用户首次登录即静默完成全库解包；
 * 迁移失败**不得**阻塞登录（双格式读取兜底，下次启动/登录重试）。
 */

const mocks = vi.hoisted(() => ({
    ensureUnlocked: vi.fn(async () => undefined),
    runPlaintextMigration: vi.fn(async () => ({ ran: true, migrated: 0, lockSkipped: false })),
    resolveUserIdFromStoredJwt: vi.fn(() => 'u-1'),
    setCurrentUserId: vi.fn(),
    getCurrentUserId: vi.fn(() => 'u-1'),
    clearSession: vi.fn(),
    lock: vi.fn(),
    initSnowflakeEpoch: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => ({
    cryptoService: {
        ensureUnlocked: mocks.ensureUnlocked,
        lock: mocks.lock,
        changePassword: vi.fn()
    },
    deletionService: { recordDeletion: vi.fn(), cancelDeletion: vi.fn() },
    initSnowflakeEpoch: mocks.initSnowflakeEpoch,
    localSession: {
        setCurrentUserId: mocks.setCurrentUserId,
        getCurrentUserId: mocks.getCurrentUserId,
        clear: mocks.clearSession
    },
    newLocalPomodoroRecordRepository: vi.fn(),
    newLocalPomodoroRepository: vi.fn(),
    newLocalProjectPreferenceRepository: vi.fn(),
    newLocalProjectRepository: vi.fn(),
    newLocalTagPreferenceRepository: vi.fn(),
    newLocalTagRepository: vi.fn(),
    newLocalTaskCheckItemRepository: vi.fn(),
    newLocalTaskCommentRepository: vi.fn(),
    newLocalTaskRepository: vi.fn(),
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
    runPlaintextMigration: mocks.runPlaintextMigration
}))

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/epoch',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/migration/plaintext-migration',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-record-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/project-preference-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/project-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/tag-preference-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/tag-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/task-check-item-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/task-comment-repo-impl',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/repos/task-repo-impl',
    async () => import('@nao-todo/infrastructure')
)

const { useCaseBinding } = await import('./binding')

type AuthUseCaseLike = {
    signIn: (vo: { password: string }) => Promise<string | null>
    signOut: (token: string) => Promise<unknown>
}

const decorate = (): AuthUseCaseLike => {
    const base: AuthUseCaseLike = {
        signIn: vi.fn(async () => null),
        signOut: vi.fn(async () => null)
    }
    return useCaseBinding.decorateAuthUseCase!(base as never) as unknown as AuthUseCaseLike
}

describe('desktop binding - 登录路径明文迁移（AC2）', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.ensureUnlocked.mockResolvedValue(undefined)
        mocks.runPlaintextMigration.mockResolvedValue({
            ran: true,
            migrated: 0,
            lockSkipped: false
        })
    })

    it('signIn 成功 ⇒ ensureUnlocked 后静默执行明文迁移', async () => {
        const useCase = decorate()
        const err = await useCase.signIn({ password: 'pw' })

        expect(err).toBeNull()
        expect(mocks.ensureUnlocked).toHaveBeenCalledWith('u-1', 'pw')
        expect(mocks.runPlaintextMigration).toHaveBeenCalledWith('u-1')
        // 顺序：解锁先于迁移
        expect(mocks.ensureUnlocked.mock.invocationCallOrder[0]!).toBeLessThan(
            mocks.runPlaintextMigration.mock.invocationCallOrder[0]!
        )
    })

    it('迁移失败不阻塞登录（返回 null，交双格式读取兜底）', async () => {
        mocks.runPlaintextMigration.mockRejectedValue(new Error('迁移失败'))
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const useCase = decorate()

        await expect(useCase.signIn({ password: 'pw' })).resolves.toBeNull()
        expect(consoleError).toHaveBeenCalled()
    })

    it('解锁失败 ⇒ 返回错误文案且不执行迁移', async () => {
        mocks.ensureUnlocked.mockRejectedValue(new Error('密码错误'))
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const useCase = decorate()

        await expect(useCase.signIn({ password: 'bad' })).resolves.toBe(
            '本地数据解锁失败，请检查密码'
        )
        expect(mocks.runPlaintextMigration).not.toHaveBeenCalled()
        expect(consoleError).toHaveBeenCalled()
    })
})