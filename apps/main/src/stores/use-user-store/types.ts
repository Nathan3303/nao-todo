export interface User {
    _id?: string
    id?: string
    email: string
    nickname: string
    avatar: string
    role: string
}

export type SigninPayload = {
    email: string
    password: string
}

export type SignupPayload = {
    email: string
    password: string
    nickname?: string
}

export type ResponseData = {
    code: number
    message: string
    data: Record<string, unknown>
}
