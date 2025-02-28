import type { User } from '@nao-todo/types'

const myAtob = (input: string): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    const str = input.replace(/=+$/, '')
    let output = ''
    if (str.length % 4 === 1) {
        throw new Error('InvalidLengthError')
    }
    for (let i = 0, len = str.length; i < len; i += 4) {
        const a = chars.indexOf(str.charAt(i))
        const b = chars.indexOf(str.charAt(i + 1))
        const c = chars.indexOf(str.charAt(i + 2))
        const d = chars.indexOf(str.charAt(i + 3))
        const sum = (a << 18) | (b << 12) | (c << 6) | d
        output += String.fromCharCode((sum >> 16) & 0xff, (sum >> 8) & 0xff, sum & 0xff)
    }
    return output
}

const getJWTPayload = (jwt: string) => {
    const jwtPayload = jwt.split('.')[1]
    const decodedPayload = JSON.parse(decodeURIComponent(atob(jwtPayload)))
    return decodedPayload as User
}

export default getJWTPayload
export { myAtob }
