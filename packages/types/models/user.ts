export interface User {
    _id?: string
    id: string
    email: string
    nickname: string
    avatar: string
    role: string
}

export type SigninOptions = {
    email: string
    password: string
}

export type SignupOptions = {
    email: string
    password: string
    nickname?: string
}
