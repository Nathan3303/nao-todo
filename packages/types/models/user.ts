import type { TasksMainBasicViewNames } from '../views/tasks'

export type UserRole = 'user' | 'admin'

export type UserPreference = {
    isUseFloatAsideDefaultly: {
        tasks: boolean
        calendar: boolean
        settings: boolean
    }
    isUseFloatOutlineDefaultly: {
        tasks: boolean
        calendar: boolean
        settings: boolean
    }
    landingPage: string
    tasksAsideNavLinkVisible: {
        [key in TasksMainBasicViewNames]: boolean
    } & {
        filter: boolean
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

