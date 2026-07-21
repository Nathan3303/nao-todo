# 移除登录注册时 MD5 密码加密的实现计划

## 一、需求分析

由于有 HTTPS 传输层保障，前端不再需要对密码进行 MD5 加密。需要移除整个密码加密流程，直接明文传输密码。

## 二、涉及文件分析

### 2.1 Domain 层

| 文件 | 涉及内容 |
|------|----------|
| `packages/domain/auth/repositories/auth.ts` | `AuthRepository` 接口定义了 `encryptPassword` 方法 |
| `packages/domain/auth/services/auth.ts` | `AuthDomain` 服务调用了 `encryptPassword` 和 `setEncryptedPassword` |
| `packages/domain/auth/valueobjects/signin.ts` | `SignInValueObject` 有 `encryptedPassword` 属性及相关方法 |
| `packages/domain/auth/valueobjects/signup.ts` | `SignUpValueObject` 有 `encryptedPassword` 属性及相关方法 |

### 2.2 Infrastructure 层

| 文件 | 涉及内容 |
|------|----------|
| `packages/infrastructure/backend/auth/repoImpl.ts` | 实现了 `encryptPassword` 方法，使用 SparkMD5 |
| `packages/infrastructure/backend/auth/converters.ts` | 使用 `getEncryptedPassword()` 获取加密密码 |
| `packages/infrastructure/backend/user/converters.ts` | 更新密码时使用 SparkMD5 加密 |

### 2.3 根 package.json

- 依赖了 `spark-md5` 和 `@types/spark-md5`

## 三、修改步骤

### 步骤 1：修改 Domain 层 - AuthRepository 接口

**文件**: `packages/domain/auth/repositories/auth.ts`

**操作**: 移除 `encryptPassword` 方法声明

### 步骤 2：修改 Domain 层 - AuthDomain 服务

**文件**: `packages/domain/auth/services/auth.ts`

**操作**:
- 删除 `signIn` 方法中的密码加密逻辑（第 28-34 行）
- 删除 `signUp` 方法中的密码加密逻辑（第 57-63 行）

### 步骤 3：修改 Domain 层 - SignInValueObject

**文件**: `packages/domain/auth/valueobjects/signin.ts`

**操作**:
- 删除 `encryptedPassword` 属性
- 删除 `setEncryptedPassword` 方法
- 删除 `getEncryptedPassword` 方法

### 步骤 4：修改 Domain 层 - SignUpValueObject

**文件**: `packages/domain/auth/valueobjects/signup.ts`

**操作**:
- 删除 `encryptedPassword` 属性
- 删除 `setEncryptedPassword` 方法
- 删除 `getEncryptedPassword` 方法

### 步骤 5：修改 Infrastructure 层 - Auth 转换器

**文件**: `packages/infrastructure/backend/auth/converters.ts`

**操作**:
- `signInValueObjectToSignInReq`: 直接使用 `signInValueObject.password` 替代 `getEncryptedPassword()`
- `signUpValueObjectToSignUpReq`: 直接使用 `signUpValueObject.password` 替代 `getEncryptedPassword()`

### 步骤 6：修改 Infrastructure 层 - Auth 仓库实现

**文件**: `packages/infrastructure/backend/auth/repoImpl.ts`

**操作**:
- 删除 `SparkMD5` 导入
- 删除 `encryptPassword` 方法实现
- 从返回对象中移除 `encryptPassword`

### 步骤 7：修改 Infrastructure 层 - User 转换器

**文件**: `packages/infrastructure/backend/user/converters.ts`

**操作**:
- 删除 `SparkMD5` 导入
- `updateUserPasswordValueObject2Req`: 直接使用明文密码，移除 `SparkMD5.hash()` 调用

### 步骤 8：清理依赖

**文件**: `package.json`

**操作**:
- 删除 `dependencies` 中的 `spark-md5`
- 删除 `devDependencies` 中的 `@types/spark-md5`

## 四、风险与注意事项

1. **后端兼容性**: 确保后端服务也已更新为接收明文密码并在服务端进行哈希存储
2. **HTTPS 依赖**: 确保生产环境已配置 HTTPS，否则密码会明文传输
3. **构建验证**: 修改完成后需运行 `pnpm install` 和构建命令验证

## 五、验证步骤

1. 运行 `pnpm install` 更新依赖
2. 运行 TypeScript 编译检查
3. 运行项目构建命令验证

## 六、依赖变更

- 移除: `spark-md5` (运行时依赖)
- 移除: `@types/spark-md5` (类型依赖)