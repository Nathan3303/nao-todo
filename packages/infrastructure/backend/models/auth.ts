// SignInReq 登录请求类型
export type SignInReq = {
    email: string
    password: string
}

// SignInRes 登录响应类型
export type SignInRes = {
    jwt: string
    pendingDeletion: boolean
    deletedAt?: string
}

// SignUpReq 注册请求类型
export type SignUpReq = {
    email: string
    password: string
    nickname: string
}

// SignOutReq 登出请求类型
export type SignOutReq = {
    token: string
    deviceType: string
}

// CheckInReq 检入请求类型
export type CheckInReq = {
    token: string
    deviceType: string
}

// CheckInRes 检入响应类型
export type CheckInRes = {
    jwt: string
    pendingDeletion: boolean
    deletedAt?: string
}
