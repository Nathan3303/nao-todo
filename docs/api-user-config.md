# 用户偏好设置 API

Base URL: `/api/user/config`
认证方式: Bearer Token (`Authorization: Bearer <token>`)

---

## 1. 获取用户配置

### Request

```
GET /api/user/config
```

无请求参数。

### Response

**成功 (10110):**

```json
{
  "code": 10110,
  "message": "获取用户配置成功",
  "data": {
    "appearance": "auto"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `data.appearance` | `string` | 外观主题，默认 `auto` |

**失败 (10111):**

```json
{
  "code": 10111,
  "message": "获取用户配置失败 - <错误详情>"
}
```

---

## 2. 更新用户配置

### Request

```
PUT /api/user/config
Content-Type: application/json
```

```json
{
  "appearance": "dark"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `appearance` | `string` | 是 | 外观主题设置 |

### Response

**成功 (10120):**

```json
{
  "code": 10120,
  "message": "更新用户配置成功"
}
```

**失败:**

| Code | 说明 |
|------|------|
| `10121` | 参数错误（缺少必填字段） |
| `10123` | 更新失败（含错误详情） |

```json
{
  "code": 10121,
  "message": "参数错误"
}
```
