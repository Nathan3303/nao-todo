type MessageHandler = (event: MessageEvent) => void
type ErrorHandler = () => void

export const useSSE = (url: string) => {
    let eventSource: EventSource | null = null

    const close = () => {
        if (!eventSource) return
        eventSource.close()
        eventSource = null
    }

    const connect = (
        uri: string,
        messageHandler: MessageHandler,
        errorHandler?: ErrorHandler
    ) => {
        if (eventSource) return

        eventSource = new EventSource(url + uri)

        eventSource.addEventListener('message', messageHandler)

        eventSource.addEventListener('error', () => {
            errorHandler?.()
            close()
        })
    }

    return { connect, close }
}
