import { describe, expect, it } from 'vite-plus/test'
import zhCN from '../zh-CN'
import enUS from '../en-US'

/**
 * T752 / Issue #360 第二轮 · 账户面板四分区**副标题**键齐备 + 说人话
 *
 * @description 四分区（资料 / 密码 / 登录设备 / 危险区）各自一句副标题：**新增 3 键**
 *              （`settings.ia.profile.desc` / `.password.desc` / `.devices.desc`）+ 危险区**复用**
 *              `settings.ia.danger.desc`。组头名全部复用现存键（⛔ 不为分区头另造新键）。
 *              键名沿用 `settings.ia.<section>.desc` 既有命名面（同 `account.desc` / `danger.desc`）。
 *
 *              值 = 文案稿单一事实来源，本文件逐字锁定（改文案须同步
 *              `docs/designs/360-settings-polish-copy.md` §一）。
 * @see docs/designs/360-settings-polish-copy.md（§一 四分区副标题）
 * @see docs/designs/360-settings-polish.md（§1 信息架构 / §3c 密码分区）
 */

/** zh-CN 期望值（= 文案稿 §一，逐字） */
const ZH_EXPECTED = {
    'settings.ia.profile.desc': '昵称、邮箱与注册时间',
    'settings.ia.password.desc': '修改后需要用新密码重新登录',
    'settings.ia.devices.desc': '已登录的浏览器与设备，可单独下线'
} as const

/** en-US 期望值（= 文案稿 §一，逐字；含弯引号与破折号） */
const EN_EXPECTED = {
    'settings.ia.profile.desc': 'Your nickname, email and sign-up date.',
    'settings.ia.password.desc': 'You’ll sign in again with the new password.',
    'settings.ia.devices.desc': 'Signed-in browsers and devices — sign out any of them.'
} as const

const KEYS = Object.keys(ZH_EXPECTED) as Array<keyof typeof ZH_EXPECTED>

type LooseCopy = Record<string, string | undefined>
const ZH = zhCN as unknown as LooseCopy
const EN = enUS as unknown as LooseCopy

describe('T752 · 账户四分区副标题文案键', () => {
    it('zh-CN 三键齐备且逐字等于文案稿', () => {
        for (const key of KEYS) expect(ZH[key], `zh-CN 缺 ${key}`).toBe(ZH_EXPECTED[key])
    })

    it('en-US 三键齐备且逐字等于文案稿', () => {
        for (const key of KEYS) expect(EN[key], `en-US 缺 ${key}`).toBe(EN_EXPECTED[key])
    })

    it('危险区副标题复用既有键（⛔ 不新增第四句）', () => {
        expect(ZH['settings.ia.danger.desc']?.trim()).toBeTruthy()
        expect(EN['settings.ia.danger.desc']?.trim()).toBeTruthy()
        expect(ZH['settings.ia.danger.desc']).toContain('请先确认')
    })

    it('四句互不相同（每区一句、一句一义）', () => {
        const zhTexts = [
            ZH['settings.ia.profile.desc'],
            ZH['settings.ia.password.desc'],
            ZH['settings.ia.devices.desc'],
            ZH['settings.ia.danger.desc']
        ]
        expect(new Set(zhTexts).size).toBe(4)
        const enTexts = [
            EN['settings.ia.profile.desc'],
            EN['settings.ia.password.desc'],
            EN['settings.ia.devices.desc'],
            EN['settings.ia.danger.desc']
        ]
        expect(new Set(enTexts).size).toBe(4)
    })

    it('说人话：不裸露内部键名（AGENTS 界面原则 ①）', () => {
        const banned = ['deactivedAt', 'createdAt', 'archivedAt', 'revision', 'profile', 'session']
        const offenders: string[] = []
        for (const key of KEYS) {
            for (const copy of [ZH[key] ?? '', EN[key] ?? '']) {
                for (const term of banned) {
                    if (copy.toLowerCase().includes(term.toLowerCase())) {
                        offenders.push(`${key} ← ${term}`)
                    }
                }
            }
        }
        expect(offenders).toEqual([])
    })

    it('无插值占位符（副标题是静态一句话，不渲染数据）', () => {
        for (const key of KEYS) {
            expect(ZH[key]).not.toMatch(/\{[a-zA-Z]+\}/)
            expect(EN[key]).not.toMatch(/\{[a-zA-Z]+\}/)
        }
    })
})