export type User = {
    id: string
    email: string
    _id?: string
    nickName: string
}

export type SubmitPayload = {
    email: string
    password: string
}
