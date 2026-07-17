export const env = {
    apiBaseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3302/api',
    appName: import.meta.env.VITE_APP_NAME || 'NaoTodo',
    baseURL: import.meta.env.VITE_BASE_URL || 'http://localhost:3302',
    showUnimplementedFeatures: import.meta.env.VITE_SHOW_UNIMPLEMENTED_FEATURES === 'true'
}

