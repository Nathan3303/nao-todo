import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { extractUserIdFromJwt } from '../session/local-session'
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
        await cryptoService.setup('user-1', 'test-password')
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
        await cryptoService.setup('user-1', 'right-password')
        cryptoService.lock()
        expect(cryptoService.isUnlocked).toBe(false)

        await expect(cryptoService.unlock('user-1', 'wrong-password')).rejects.toThrow()
        expect(cryptoService.isUnlocked).toBe(false)
    })

    it('正确密码 unlock 后可解密既有密文', async () => {
        await cryptoService.setup('user-1', 'right-password')
        const cipher = await cryptoService.encrypt('持久化密文')
        cryptoService.lock()

        await cryptoService.unlock('user-1', 'right-password')
        expect(cryptoService.isUnlocked).toBe(true)
        expect(await cryptoService.decrypt(cipher)).toBe('持久化密文')
    })

    it('lock 后密文不可读', async () => {
        await cryptoService.setup('user-1', 'pw')
        await cryptoService.encrypt('x')
        cryptoService.lock()
        await expect(cryptoService.decrypt('a:bc')).rejects.toThrow('本地密钥未解锁')
    })

    it('changePassword 后旧密码失效、新密码可解锁', async () => {
        await cryptoService.setup('user-1', 'old-password')
        const cipher = await cryptoService.encrypt('改密后仍可读')
        cryptoService.lock()

        await cryptoService.changePassword('user-1', 'old-password', 'new-password')
        cryptoService.lock()

        await expect(cryptoService.unlock('user-1', 'old-password')).rejects.toThrow()
        await cryptoService.unlock('user-1', 'new-password')
        expect(await cryptoService.decrypt(cipher)).toBe('改密后仍可读')
    })

    it('多用户密钥包相互隔离：各自独立 DEK', async () => {
        // user-1 建立密钥包
        await cryptoService.setup('user-1', 'pw-1')
        expect(await cryptoService.hasKeyBundle('user-1')).toBe(true)
        expect(await cryptoService.hasKeyBundle('user-2')).toBe(false)
        cryptoService.lock()

        // user-2 建立自己的密钥包
        await cryptoService.setup('user-2', 'pw-2')
        const cipher2 = await cryptoService.encrypt('user-2 的密文')
        expect(await cryptoService.hasKeyBundle('user-2')).toBe(true)
        cryptoService.lock()

        // 各自用各自密码解锁，密文互不通用
        await cryptoService.unlock('user-1', 'pw-1')
        await expect(cryptoService.unlock('user-2', 'pw-1')).rejects.toThrow()
        cryptoService.lock()
        await cryptoService.unlock('user-2', 'pw-2')
        expect(await cryptoService.decrypt(cipher2)).toBe('user-2 的密文')
    })
})

describe('extractUserIdFromJwt', () => {
    // 真实签发的 JWT：payload.Id 为超出 Number.MAX_SAFE_INTEGER 的雪花数字
    const REAL_JWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJZCI6NDIyNjQ0NjExODcwMTAxNTA0LCJQYXlsb2FkIjoibGVlMTkyOEBvdXRsb29rLmNvbSIsImlzcyI6Ik5hb1RvZG9TZXJ2ZXIiLCJzdWIiOiJUb2tlbiIsImV4cCI6MTc4NjA4MjQyNSwiaWF0IjoxNzg1OTA5NjI1fQ.hs5yiNXTWbWG8YYMsdMFAjTGCI74MSufjvc2mgK67ko'

    it('从真实 JWT 精确提取雪花 ID 字符串（不丢精度）', () => {
        expect(extractUserIdFromJwt(REAL_JWT)).toBe('422644611870101504')
        // 反向断言：JSON.parse 会丢精度为 ...500，正则提取必须保持精确值
        expect(extractUserIdFromJwt(REAL_JWT)).not.toBe('422644611870101500')
    })

    it('兼容小写 id 字段（顶层）', () => {
        const jwt = `header.${btoa(JSON.stringify({ id: 12345, iss: 'test' }))}.signature`
        expect(extractUserIdFromJwt(jwt)).toBe('12345')
    })

    it('兜底兼容 profile.id 结构', () => {
        const jwt = `header.${btoa(JSON.stringify({ profile: { id: 'p-abc' } }))}.signature`
        expect(extractUserIdFromJwt(jwt)).toBe('p-abc')
    })

    it('无效 JWT 返回 null', () => {
        expect(extractUserIdFromJwt('')).toBeNull()
        expect(extractUserIdFromJwt('not-a-jwt')).toBeNull()
        expect(extractUserIdFromJwt('a.b')).toBeNull()
    })
})