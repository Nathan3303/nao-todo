// 用户 JWT 存储键名
export const USER_JWT_LOCALSTORAGE_KEY = 'USER_JWT'

// 离线身份缓存键名（SHELL-03 C-15：仅白名单字段，明文 localStorage，解锁前可读）
export const USER_PROFILE_CACHE_KEY = 'USER_PROFILE_CACHE'

// 语言存储键名
export const LANGUAGE_KEY = 'USER_LANGUAGE'

// 主题存储键名
export const THEME_MODE_KEY = 'USER_THEME_MODE'

// 用户邮箱正则表达式
export const USER_EMAIL_REGEXP = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 用户密码正则表达式
export const USER_PASSWORD_REGEXP = /^\S*(?=\S{8})(?=\S*\d)(?=\S*[a-z])(?=\S*[!@#$%^&*?.-])\S*$/