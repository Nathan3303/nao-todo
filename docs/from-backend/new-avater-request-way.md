# 头像文件访问方式变更 —— 前端落地方案

## 1. 变更背景

服务端已不再把头像上传目录作为开放静态目录直接提供（此前 `GET /static/uploads/avatars/xxx.png` 无需任何凭证即可访问任意用户头像文件）。

**新规则**：头像文件访问必须携带登录凭证（JWT）。任何已登录用户可查看任意头像，未登录/凭证失效无法获取图片。

> 背景知识：头像文件路径本身未变（`/static/uploads/avatars/{userId}.{ext}`），数据库中存量头像 URL 无需迁移，**前端只需在请求时附加 token，并做好加载失败兜底**。

## 2. 新的访问方式

### 2.1 头像资源端点

```
GET /static/uploads/avatars/{filename}
```

- `{filename}` 形如 `453525082325651456.png`（`{userId}.{ext}`，ext ∈ jpg/jpeg/png）
- URL 保持不变，仅访问条件变化

### 2.2 携带凭证的两种方式（二选一）

| 方式                                 | 适用场景                                              | 示例                                                    |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------- |
| Query 参数 `?token=<jwt>`            | `<img src>` 直接加载（浏览器无法为 img 自定义请求头） | `https://xxx/static/uploads/avatars/1.png?token=eyJ...` |
| 请求头 `Authorization: Bearer <jwt>` | fetch/axios 以 blob 方式加载                          | `Authorization: Bearer eyJ...`                          |

服务端两种方式均支持（`?token=` 与 SSE 事件流为同一套机制，前端已有先例）。

### 2.3 响应语义

| 场景                                        | 结果                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 未携带 token / token 失效                   | HTTP 200 + `{"code":10041,"message":"用户凭证验证失败",...}`（**不是图片**，`<img>` 渲染失败）         |
| 文件名非法（非数字+白名单后缀）或文件不存在 | HTTP 404                                                                                               |
| 成功                                        | HTTP 200，`Content-Type: image/jpeg\|image/png`，`Cache-Control: private, max-age=31536000, immutable` |

> 注意：凭证失效的响应是 HTTP 200 + JSON（项目统一风格），前端**不要依赖 HTTP 状态码判断**，直接用 `<img>` 的 `error` 事件兜底即可。

## 3. 后端返回头像 URL 的接口清单（需改造的数据源）

以下接口返回的头像字段是**完整 URL**（已拼接服务地址，如 `http://localhost:3310/static/uploads/avatars/453525082325651456.png`），前端渲染这些 URL 时必须附加 token：

| 接口                             | 字段              | 说明                      |
| -------------------------------- | ----------------- | ------------------------- |
| `GET /api/user/profile`          | `data.avatar`     | 本人头像                  |
| `PUT /api/user/avatar`           | `data.avatarURL`  | 上传/更新头像后的回显 URL |
| `GET /api/comments/`（评论列表） | 每条评论 `avatar` | 评论作者头像              |
| `GET /api/comments/:commentId`   | `avatar`          | 单条评论作者头像          |

另外：通过 JSON 方式设置的头像可能是**外部 URL**（如第三方图床 `https://...`），此类外链**不需要 token**，原样渲染。

## 4. 前端落地要点

### 4.1 统一封装头像 URL 工具

建议新增一个工具函数，所有头像渲染统一走它，避免散落拼接逻辑：

```ts
// avatar.ts
/** 是否为本服务的头像资源路径 */
function isLocalAvatar(url: string): boolean {
    return url.includes('/static/uploads/avatars/')
}

/** 是否为外部绝对 URL */
function isExternalUrl(url: string): boolean {
    return /^https?:\/\//i.test(url)
}

/**
 * 生成可加载的头像地址
 * @param avatar 后端返回的头像字段（可能为空 / 外链 / 本服务相对或完整路径）
 * @param token 当前登录 JWT（登录后才有）
 * @returns 可直接用于 <img src> 的地址；空返回空串由调用方兜底默认头像
 */
export function getAvatarSrc(avatar: string, token: string): string {
    if (!avatar) return ''
    // 外链头像：无需 token
    if (isExternalUrl(avatar) && !isLocalAvatar(avatar)) return avatar
    // 本服务头像：追加 token（注意处理可能已带 query 的情况）
    const sep = avatar.includes('?') ? '&' : '?'
    return `${avatar}${sep}token=${encodeURIComponent(token)}`
}
```

### 4.2 渲染组件兜底

所有 `<img>` 增加 `error` 事件兜底，token 失效/文件缺失时显示默认头像：

```vue
<img :src="getAvatarSrc(comment.avatar, token)" @error="onAvatarError" alt="" />

<!-- script -->
<script setup lang="ts">
const onAvatarError = (e: Event) => {
    ;(e.target as HTMLImageElement).src = defaultAvatarUrl // 本地默认头像
}
</script>
```

### 4.3 token 生命周期处理

- 头像 URL 携带的是**拼接时刻的 token**；token 过期、轮换或重新登录后，旧 URL 将失效。
- 建议将 `token` 作为响应式依赖：登录态变化（`login` / `logout` / token 刷新）时触发头像组件重新计算 `src`，或在全局提供 token 变更的响应式状态。
- 无需为每个头像请求重新登录，只需保证 `<img>` 的 src 在 token 更新后刷新。

### 4.4 需要排查改造的页面

1. 用户资料页 / 个人中心（本人头像）
2. 任务评论列表、评论详情（评论作者头像）
3. 全局导航 / 侧边栏中的当前用户头像（若存在）
4. 任何 `v-html` 或富文本内嵌的头像 URL（如有，需一并处理，`<img>` 同样走 `getAvatarSrc`）

## 5. 边界与注意事项

1. **外链头像不追加 token**：仅本服务头像路径（含 `/static/uploads/avatars/`）需要。
2. **缓存策略**：服务端返回 `private, max-age=31536000, immutable`，同一 URL 可安全复用浏览器缓存；token 变化会使 URL 变化，浏览器视为新资源，符合预期。
3. **安全提示**：token 出现在 URL 中会进入浏览器历史与访问日志；项目已配置 `Referrer-Policy: strict-origin-when-cross-origin`。请勿将带头像 URL 分享给站外，也不要输出到第三方统计/日志系统。
4. **上传回显**：`PUT /api/user/avatar` 返回的 `avatarURL` 同样需要走 `getAvatarSrc` 再渲染。
5. **默认头像**：所有头像场景保持统一的默认头像兜底，避免出现破碎图片（`alt`/破图 icon）。

## 6. 前端自测清单

- [ ] 登录后，本人在「资料页」能看到自己头像
- [ ] 登录后，任务评论能正常显示他人头像
- [ ] 未登录/清除 token 后，所有头像位置显示默认头像（不出现破图）
- [ ] 手动把 URL 中的 token 改错后刷新，头像回落默认头像
- [ ] 外部图床头像（JSON 方式设置的外链）不加 token 也能显示
- [ ] 重新登录后头像能随新 token 正常加载