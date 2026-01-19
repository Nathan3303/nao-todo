import type { SignUpValueObject, SignInValueObject } from './valueobjects'
import type { AuthRepository } from './repositories'
import type { GoAsync } from '@nao-todo/types'

export class AuthDomain {
    /**
     * 认证域
     * @param authRepo 认证仓库
     */
    constructor(private authRepo: AuthRepository) {}

    /**
     * 登录
     * @param vo 登录值对象
     * @returns 登录凭证
     */
    async signIn(vo: SignInValueObject): GoAsync<string> {
        // 1. 加密密码
        const [ePasswd, encryptErr] = this.authRepo.encryptPassword(vo.password)
        if (encryptErr !== null) {
            return ['', encryptErr]
        }
        // 2. 登录
        vo.password = ePasswd
        const [jwt, signInErr] = await this.authRepo.signIn(vo)
        if (signInErr !== null) {
            return ['', signInErr]
        }
        // 3. 保存登录凭证
        this.authRepo.saveJwtToLocalStorage(jwt)
        // 4. 返回
        return [jwt, null]
    }

    /**
     * 注册
     * @param vo 注册值对象
     * @returns 错误信息
     */
    async signUp(vo: SignUpValueObject): GoAsync<void> {
        // 1. 加密密码
        const [ePasswd, encryptErr] = this.authRepo.encryptPassword(vo.password)
        if (encryptErr !== null) {
            return encryptErr
        }
        // 2. 注册
        vo.password = ePasswd
        return await this.authRepo.signUp(vo)
    }

    /**
     * 检入
     * @returns 新用户凭据
     */
    async checkIn(): GoAsync<string> {
        // 1. 从本地存储获取登录凭证
        const jwtFromLocalStorage = this.authRepo.getJwtFromLocalStorage()
        if (jwtFromLocalStorage === null) {
            return [null, new Error('未登录')]
        }
        // 2. 检查登录状态
        const [newJwt, err] = await this.authRepo.checkIn(jwtFromLocalStorage)
        // 3. 若检入失败则删除凭据
        if (err !== null) {
            // 3. 移除登录凭证
            this.authRepo.removeJwtFromLocalStorage()
            return [null, err]
        }
        // 4. 若检入成功则保存新凭证
        this.authRepo.saveJwtToLocalStorage(newJwt)
        // 3. 返回新用户凭据
        return [newJwt, null]
    }

    /**
     * 退出登录
     * @param jwt 登录凭证
     * @returns 错误信息
     */
    async signOut(): GoAsync<void> {
        // 1. 读取本地存储中的登录凭证
        const jwtFromLocalStorage = this.authRepo.getJwtFromLocalStorage()
        if (jwtFromLocalStorage === null) {
            return '未登录'
        }
        // 2. 退出登录
        const err = await this.authRepo.signOut(jwtFromLocalStorage)
        if (err !== null) {
            return err
        }
        // 3. 移除登录凭证
        this.authRepo.removeJwtFromLocalStorage()
        return null
    }
}
