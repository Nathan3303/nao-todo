import { UserEntity } from "@nao-todo/domain/user";
import { GetUserProfileRes } from "../types/user";

export const getUserProfileRes2UserEntity = (res: GetUserProfileRes): UserEntity => {
    const e = new UserEntity()
    e.email = res.email
    e.nickname = res.nickname
    e.avatar = res.avatar
    e.role = res.role
    e.createdAt = res.createdAt
    e.updatedAt = res.updatedAt
    return e
}