export const useApiResult = (code: number, message: string, payload?: Record<string, any>) => {
    return {
        code,
        message,
        payload
    }
}
