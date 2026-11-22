import { describe, expect, it } from 'vite-plus/test'
import { resolveInstallMode } from '../install-mode'

/**
 * T736 · 安装形态判定（AC3 / AC4b / AC7 · ADR 平台矩阵）
 *
 * @description 判定必须是**纯函数**（`platform` / `appimage` / `isPackaged` 显式入参，零 IO、
 *              零 `electron` 依赖），⛔ 不做「试一次原地更新、失败再降级」。
 *              AC7 的自动化面全在这里：macOS / Linux deb ⇒ `download-page` + 一行原因；
 *              AC4b（2026-11-22 走查反馈）**修正判定顺序**：先判 `isPackaged`（未打包 ⇒ `dev`）
 *              再判平台 —— 旧实现把 `linux + !isPackaged` 落成 `deb`，等于告诉开发态用户
 *              「deb 版由系统包管理」（实报 bug）。
 */

describe('resolveInstallMode（AC3 / AC4b / AC7 判定表）', () => {
    it('Windows 安装版（已打包）⇒ 原地更新', () => {
        expect(resolveInstallMode({ platform: 'win32', isPackaged: true })).toEqual({
            mode: 'in-place'
        })
    })

    it('Windows 开发态（未打包）⇒ 下载页 + dev 原因（无更新源）', () => {
        expect(resolveInstallMode({ platform: 'win32', isPackaged: false })).toEqual({
            mode: 'download-page',
            degradedReason: 'dev'
        })
    })

    it('Linux AppImage（已打包 + APPIMAGE 非空）⇒ 原地更新', () => {
        expect(
            resolveInstallMode({
                platform: 'linux',
                appimage: '/home/u/Applications/nao-todo-1.20.3.AppImage',
                isPackaged: true
            })
        ).toEqual({ mode: 'in-place' })
    })

    it('Linux deb（无 APPIMAGE）⇒ 下载页 + deb 原因', () => {
        expect(
            resolveInstallMode({ platform: 'linux', appimage: undefined, isPackaged: true })
        ).toEqual({ mode: 'download-page', degradedReason: 'deb' })
    })

    it('Linux AppImage 但 APPIMAGE 为空串 ⇒ 按 deb 处理（不靠猜测）', () => {
        expect(resolveInstallMode({ platform: 'linux', appimage: '', isPackaged: true })).toEqual({
            mode: 'download-page',
            degradedReason: 'deb'
        })
    })

    it('macOS（ad-hoc 未签名）⇒ 下载页 + mac 原因', () => {
        expect(
            resolveInstallMode({ platform: 'darwin', appimage: undefined, isPackaged: true })
        ).toEqual({ mode: 'download-page', degradedReason: 'mac' })
    })

    it('未知平台 ⇒ 下载页且不给原因（不编造平台说明）', () => {
        expect(resolveInstallMode({ platform: 'freebsd', isPackaged: true })).toEqual({
            mode: 'download-page'
        })
    })

    /**
     * AC4b 的核心回归：判定顺序 **dev 优先于平台**
     * @description 以下四条是旧实现会给出**错误原因**（deb / mac / in-place）的组合，
     *              都必须是 `download-page + dev`：开发态没有更新源，与平台/APPIMAGE 无关。
     */
    it.each([
        { name: 'Linux 开发态（无 APPIMAGE）', platform: 'linux', appimage: undefined },
        {
            name: 'Linux 开发态（残留 APPIMAGE 环境变量也不得判成原地更新）',
            platform: 'linux',
            appimage: '/home/u/dev.AppImage'
        },
        { name: 'macOS 开发态（不得判成 mac）', platform: 'darwin', appimage: undefined },
        { name: '未知平台开发态', platform: 'freebsd', appimage: undefined }
    ])('$name ⇒ 下载页 + dev 原因（dev 先于平台判定）', ({ platform, appimage }) => {
        expect(resolveInstallMode({ platform, appimage, isPackaged: false })).toEqual({
            mode: 'download-page',
            degradedReason: 'dev'
        })
    })
})