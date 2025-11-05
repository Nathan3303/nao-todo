export type UserRole = 'user' | 'admin'

export type UserPreference = {
    isUseFloatAsideDefaultly: {
        tasks: boolean
        settings: boolean
    }
    isUseFloatOutlineDefaultly: {
        tasks: boolean
    }
    landingPage: {
        tasks: string
    }
}

export interface User {
    _id?: string
    id: string
    email: string
    nickname: string
    avatar: string
    role: UserRole
    createdAt: string | Date
    preference?: UserPreference
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

