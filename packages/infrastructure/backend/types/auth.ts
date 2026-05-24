export type SignInReq = {
    email: string
    password: string
}

export type SignInRes = {
    jwt: string
}

export type SignUpReq = {
    email: string
    password: string
    nickname: string
}

export type CheckInRes = SignInRes
