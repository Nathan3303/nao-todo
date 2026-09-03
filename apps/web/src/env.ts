type Env = {
    readonly appType: 'web' | 'desktop'
    readonly appName: string
    readonly apiBaseURL: string
    readonly baseURL: string
    readonly showUnimplementedFeatures: boolean
}

export const env: Env = {
    appType: import.meta.env.VITE_APP_TYPE || 'web',
    appName: import.meta.env.VITE_APP_NAME || 'NaoTodo',
    apiBaseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3302/api',
    baseURL: import.meta.env.VITE_BASE_URL || 'http://localhost:3302',
    showUnimplementedFeatures: import.meta.env.VITE_SHOW_UNIMPLEMENTED_FEATURES === 'true'
}