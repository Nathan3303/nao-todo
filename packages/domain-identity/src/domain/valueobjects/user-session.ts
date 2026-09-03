/**
 * 用户登录会话值对象
 * @description 一条登录端会话（设备绑定）。服务端返回的会话列表项。
 */
export class UserSessionValueObject {
    /**
     * 用户登录会话值对象
     * @param id 会话 ID（雪花 ID，下线单条时用）
     * @param deviceId 设备 ID（老客户端/未携带时为空串）
     * @param deviceType 设备/浏览器类型（Chrome / iOS / Android / WeChat / Alipay / Safari / Firefox / Unknown 等）
     * @param ip4 登录端 IPv4 地址
     * @param region IP 归属地（如 广东·深圳）；内网/解析失败为 未知
     * @param createdAt 登录时间（RFC3339）
     * @param updatedAt 最近活跃时间（RFC3339）
     * @param current 是否为「本次请求所在」的会话（当前设备）
     */
    constructor(
        public id: string,
        public deviceId: string,
        public deviceType: string,
        public ip4: string,
        public region: string,
        public createdAt: string,
        public updatedAt: string,
        public current: boolean
    ) {}
}