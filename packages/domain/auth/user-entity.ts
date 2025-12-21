export type UserEntity = {
    id: string
    email: string
    password: string
    nickname: string
}

export const makeUserEntity = (): UserEntity => {
    return {
        id: '',
        email: '',
        password: '',
        nickname: ''
    }
}