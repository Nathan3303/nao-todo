import { localDatabase } from '../db/local-database'

/**
 * 测试专用：构造真实历史密钥包 + 旧实现加密函数
 * @description 迁移/双格式读取测试需要「真密文」（`base64(iv):base64(ct)`）；
 *              新实现 `cryptoService.encrypt` 已为明文直通，故在此复刻旧加密。
 *              仅测试使用，不参与构建。
 */

const PBKDF2_ITERATIONS = 600_000
const textEncoder = new TextEncoder()

const toBase64 = (buf: ArrayBuffer | Uint8Array): string => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
}

export const seedLegacyCipher = async (
    userId: string,
    password: string
): Promise<{ encrypt: (plain: string) => Promise<string> }> => {
    const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt'
    ])
    const dekRaw = await crypto.subtle.exportKey('raw', dek)
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    )
    const kek = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const wrappedDek = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, dekRaw)
    await localDatabase.meta.put({
        id: `${userId}:key-bundle`,
        salt: toBase64(salt),
        iv: toBase64(iv),
        wrappedDek: toBase64(wrappedDek)
    })
    return {
        encrypt: async (plain: string): Promise<string> => {
            const fieldIv = crypto.getRandomValues(new Uint8Array(12))
            const cipher = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: fieldIv },
                dek,
                textEncoder.encode(plain)
            )
            return `${toBase64(fieldIv)}:${toBase64(cipher)}`
        }
    }
}