export const parseTheme = (value?: string, prefix: string): string[] => {
    if (!value) return []
    const values = value.split(',').map((item) => item.trim())
    return values.map((v) => `${prefix}--${v}`)
}
