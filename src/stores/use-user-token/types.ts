export type User = {
    name: string
    email: string
}

export type InnerUserAccount = {
    password: string
} & User

export type SubmitPayload = {
    email: string
    password: string
}
