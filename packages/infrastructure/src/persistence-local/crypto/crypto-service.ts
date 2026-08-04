import { localDatabase } from '../db/local-database'

/**
 * 密钥派生迭代次数
 * @description OWASP 建议 PBKDF2-SHA256 不低于 600k 次迭代
 */
const PBKDF2_ITERATIONS = 600_000

/**
 * 密钥包在 meta 表中的主键
 */
const KEY_BUNDLE_ID = 'key-bundle'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/**
 * ArrayBuffer | Uint8Array → base64
 */
const toBase64 = (buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
}

/**
 * base64 → Uint8Array
 */
const fromBase64 = (str: string): Uint8Array<ArrayBuffer> => {
    const binary = atob(str)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

/**
 * 本地数据加密服务
 * @description 双层密钥体系：
 *              用户密码经 PBKDF2 派生 KEK（密钥加密密钥），KEK 仅用于解开 DEK（数据加密密钥）；
 *              业务数据全部用 DEK 做 AES-GCM 加密。DEK 只在内存中，登出/锁定时清空。
 *              密钥包（salt + iv + wrappedDek）存于 IndexedDB meta 表。
 */
export class CryptoService {
    private dek: CryptoKey | null = null

    /**
     * 是否已解锁（DEK 在内存中）
     */
    get isUnlocked(): boolean {
        return this.dek !== null
    }

    /**
     * 首次初始化：生成 DEK 并用密码派生的 KEK 包裹，密钥包写入 meta 表
     * @param password 用户密码
     */
    async setup(password: string): Promise<void> {
        if (!password) throw new Error('密码不能为空')
        // 1. 生成随机 DEK
        const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
            'encrypt',
            'decrypt'
        ])
        const dekRaw = await crypto.subtle.exportKey('raw', dek)
        // 2. 随机 salt 派生 KEK
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const kek = await this.deriveKek(password, salt)
        // 3. 用 KEK 包裹 DEK
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const wrappedDek = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, dekRaw)
        // 4. 密钥包持久化
        await localDatabase.meta.put({
            id: KEY_BUNDLE_ID,
            salt: toBase64(salt),
            iv: toBase64(iv),
            wrappedDek: toBase64(wrappedDek)
        })
        this.dek = dek
    }

    /**
     * 解锁：用密码派生 KEK 解开 DEK
     * @param password 用户密码
     * @throws 密码错误或密钥包缺失时抛出异常
     */
    async unlock(password: string): Promise<void> {
        if (!password) throw new Error('密码不能为空')
        const bundle = await localDatabase.meta.get(KEY_BUNDLE_ID)
        if (!bundle) throw new Error('本地密钥包不存在，请先初始化')
        const kek = await this.deriveKek(password, fromBase64(bundle.salt))
        const dekRaw = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64(bundle.iv) },
            kek,
            fromBase64(bundle.wrappedDek)
        )
        this.dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, [
            'encrypt',
            'decrypt'
        ])
    }

    /**
     * 锁定：清空内存中的 DEK，本地密文不可读
     */
    lock(): void {
        this.dek = null
    }

    /**
     * 是否已存在本地密钥包（决定首次 setup 还是 unlock）
     */
    async hasKeyBundle(): Promise<boolean> {
        const bundle = await localDatabase.meta.get(KEY_BUNDLE_ID)
        return bundle !== undefined
    }

    /**
     * 确保本地数据已解锁
     * @description 已解锁直接返回；有密钥包则用密码解锁，否则用密码初始化密钥包
     * @param password 用户密码
     */
    async ensureUnlocked(password: string): Promise<void> {
        if (this.dek !== null) return
        if (await this.hasKeyBundle()) {
            await this.unlock(password)
        } else {
            await this.setup(password)
        }
    }

    /**
     * 修改密码：用旧密码解开 DEK，用新密码重新包裹
     * @param oldPassword 旧密码
     * @param newPassword 新密码
     */
    async changePassword(oldPassword: string, newPassword: string): Promise<void> {
        if (!newPassword) throw new Error('新密码不能为空')
        const bundle = await localDatabase.meta.get(KEY_BUNDLE_ID)
        if (!bundle) throw new Error('本地密钥包不存在，请先初始化')
        // 1. 旧密码解开 DEK（密码错误在此抛异常）
        const oldKek = await this.deriveKek(oldPassword, fromBase64(bundle.salt))
        const dekRaw = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64(bundle.iv) },
            oldKek,
            fromBase64(bundle.wrappedDek)
        )
        const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, true, [
            'encrypt',
            'decrypt'
        ])
        // 2. 新密码重新包裹（换新 salt + iv）
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const newKek = await this.deriveKek(newPassword, salt)
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const wrappedDek = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, newKek, dekRaw)
        await localDatabase.meta.put({
            id: KEY_BUNDLE_ID,
            salt: toBase64(salt),
            iv: toBase64(iv),
            wrappedDek: toBase64(wrappedDek)
        })
        this.dek = dek
    }

    /**
     * 加密明文字段
     * @param plain 明文
     * @returns "base64(iv):base64(密文)" 格式
     */
    async encrypt(plain: string): Promise<string> {
        if (!this.dek) throw new Error('本地密钥未解锁')
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            this.dek,
            textEncoder.encode(plain)
        )
        return `${toBase64(iv)}:${toBase64(cipher)}`
    }

    /**
     * 解密字段
     * @param cipher "base64(iv):base64(密文)" 格式
     * @returns 明文
     */
    async decrypt(cipher: string): Promise<string> {
        if (!this.dek) throw new Error('本地密钥未解锁')
        const [ivB64, ctB64] = cipher.split(':')
        if (!ivB64 || !ctB64) throw new Error('密文格式无效')
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64(ivB64) },
            this.dek,
            fromBase64(ctB64)
        )
        return textDecoder.decode(plain)
    }

    /**
     * PBKDF2 派生 KEK
     * @param password 用户密码
     * @param salt 随机盐
     * @returns AES-GCM 密钥（KEK）
     */
    private async deriveKek(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            textEncoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        )
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
    }
}

/**
 * 加密服务单例
 */
export const cryptoService = new CryptoService()