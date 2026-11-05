/**
 * 跨标签「拉取完成」广播（T654 / R-6 / AC7）
 *
 * @description `navigator.locks` 单主只解决了「同一时刻只有一个标签发网络请求」，
 *              但**未取到锁的标签不拉取也没有补偿** ⇒ 它的界面会永久陈旧（既有缺陷，T653 §6.4）。
 *              本模块补上另一半：主标签拉取成功后广播一条**无数据载荷**的通知（`{type, userId, at}`），
 *              非主标签收到后**只刷新本地视图**（数据来自同一 IndexedDB，不二次发网络）。
 *
 *              ⛔ 广播不得携带业务数据 / 版本号（否则等于第二条裁决路径，T653 §6.1）。
 *              环境无 `BroadcastChannel`（老浏览器 / node 测试）⇒ 全部降级为 no-op，不抛错。
 */

/** 频道名（同 origin 多标签共享） */
export const PULL_BROADCAST_CHANNEL_NAME = 'nao-todo:pull-complete'

/** 广播消息（仅信号；无业务数据） */
export interface PullCompleteMessage {
    type: 'pull-complete'
    /** 拉取者所属用户（接收侧据此忽略他人账号的消息） */
    userId: string
    /** 拉取完成时间（ms epoch；接收侧据此收敛合并门） */
    at: number
}

/** `BroadcastChannel` 最小面（便于测试注入替身） */
export interface PullBroadcastChannelLike {
    postMessage(message: unknown): void
    addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
    removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
    close(): void
}

export interface PullBroadcast {
    /** 广播「已拉取」（失败/无频道 ⇒ 静默 no-op） */
    post(userId: string, at?: number): void
    /** 订阅（返回取消订阅；无频道 ⇒ 返回 no-op） */
    subscribe(listener: (message: PullCompleteMessage) => void): () => void
    /** 释放频道（卸载/登出） */
    dispose(): void
}

/** 默认频道工厂（`BroadcastChannel` 不可用 / 构造抛错 ⇒ null） */
const openDefaultChannel = (): PullBroadcastChannelLike | null => {
    if (typeof BroadcastChannel === 'undefined') return null
    try {
        return new BroadcastChannel(PULL_BROADCAST_CHANNEL_NAME)
    } catch {
        return null
    }
}

/**
 * 创建广播句柄（**独立频道实例**：拉取侧与监听侧各自持有，互不干扰释放）
 * @param openChannel 频道工厂（测试注入；缺省用全局 `BroadcastChannel`）
 */
export const createPullBroadcast = (
    openChannel: () => PullBroadcastChannelLike | null = openDefaultChannel
): PullBroadcast => {
    let channel: PullBroadcastChannelLike | null = null
    let disposed = false

    const getChannel = (): PullBroadcastChannelLike | null => {
        if (disposed) return null
        if (channel === null) channel = openChannel()
        return channel
    }

    return {
        post: (userId, at = Date.now()) => {
            if (!userId) return
            const message: PullCompleteMessage = { type: 'pull-complete', userId, at }
            try {
                getChannel()?.postMessage(message)
            } catch {
                // 广播是**尽力而为**的通知：失败不得影响拉取本身
            }
        },

        subscribe: (listener) => {
            const target = getChannel()
            if (!target) return () => {}
            const handler = (event: { data: unknown }): void => {
                const data = event?.data as Partial<PullCompleteMessage> | null | undefined
                if (!data || data.type !== 'pull-complete') return
                if (typeof data.userId !== 'string' || data.userId === '') return
                listener({
                    type: 'pull-complete',
                    userId: data.userId,
                    at: typeof data.at === 'number' ? data.at : Date.now()
                })
            }
            target.addEventListener('message', handler)
            return () => {
                try {
                    target.removeEventListener('message', handler)
                } catch {
                    // 频道已关闭：无需补偿
                }
            }
        },

        dispose: () => {
            disposed = true
            const target = channel
            channel = null
            try {
                target?.close()
            } catch {
                // 已关闭：忽略
            }
        }
    }
}