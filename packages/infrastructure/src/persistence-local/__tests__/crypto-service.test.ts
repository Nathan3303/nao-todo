import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { cryptoService } from '../crypto/crypto-service'
import { localDatabase } from '../db/local-database'

/**
 * 清空本地数据库（各表）并锁定密钥
 */
const resetLocalState = async () => {
    await Promise.all([
        localDatabase.projects.clear(),
        localDatabase.projectPreferences.clear(),
        localDatabase.tags.clear(),
        localDatabase.tagPreferences.clear(),
        localDatabase.tasks.clear(),
        localDatabase.taskCheckItems.clear(),
        localDatabase.taskComments.clear(),
        localDatabase.pomodoros.clear(),
        localDatabase.pomodoroRecords.clear(),
        localDatabase.users.clear(),
        localDatabase.userConfigs.clear(),
        localDatabase.meta.clear()
    ])
    cryptoService.lock()
}

describe('CryptoService 密钥管理', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('setup 后可加密/解密往返', async () => {
        await cryptoService.setup('test-password')
        expect(cryptoService.isUnlocked).toBe(true)

        const cipher = await cryptoService.encrypt('任务名称 🔒')
        expect(cipher).not.toContain('任务名称')
        const plain = await cryptoService.decrypt(cipher)
        expect(plain).toBe('任务名称 🔒')
    })

    it('未解锁时加密抛错', async () => {
        await expect(cryptoService.encrypt('x')).rejects.toThrow('本地密钥未解锁')
    })

    it('错误密码 unlock 抛错且不改变锁定状态', async () => {
        await cryptoService.setup('right-password')
        cryptoService.lock()
        expect(cryptoService.isUnlocked).toBe(false)

        await expect(cryptoService.unlock('wrong-password')).rejects.toThrow()
        expect(cryptoService.isUnlocked).toBe(false)
    })

    it('正确密码 unlock 后可解密既有密文', async () => {
        await cryptoService.setup('right-password')
        const cipher = await cryptoService.encrypt('持久化密文')
        cryptoService.lock()

        await cryptoService.unlock('right-password')
        expect(cryptoService.isUnlocked).toBe(true)
        expect(await cryptoService.decrypt(cipher)).toBe('持久化密文')
    })

    it('lock 后密文不可读', async () => {
        await cryptoService.setup('pw')
        await cryptoService.encrypt('x')
        cryptoService.lock()
        await expect(cryptoService.decrypt('a:bc')).rejects.toThrow('本地密钥未解锁')
    })

    it('changePassword 后旧密码失效、新密码可解锁', async () => {
        await cryptoService.setup('old-password')
        const cipher = await cryptoService.encrypt('改密后仍可读')
        cryptoService.lock()

        await cryptoService.changePassword('old-password', 'new-password')
        cryptoService.lock()

        await expect(cryptoService.unlock('old-password')).rejects.toThrow()
        await cryptoService.unlock('new-password')
        expect(await cryptoService.decrypt(cipher)).toBe('改密后仍可读')
    })
})