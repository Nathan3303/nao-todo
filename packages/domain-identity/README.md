# @nao-todo/domain-identity

身份认证领域包，负责用户、认证会话的领域模型与用例。

## 📐 分层结构

遵循 DDD 分层，包内含 `domain/`（领域层）与 `application/`（应用层）两层：

- **`domain/`** — 纯 TypeScript 领域内核，零框架依赖
    - `entities/` — 领域实体：`UserEntity`（用户基本信息与状态）、`UserConfigEntity`（用户配置）
    - `repositories/` — 仓储接口：`AuthRepository`、`UserRepository`、`UserConfigRepository`（由 `@nao-todo/infrastructure` 实现）
    - `services/` — 领域服务：`AuthService`、`UserService`
    - `valueobjects/` — 值对象与入参校验：`SignIn`、`SignUp`、`AuthSession`、`DeactiveUser`、`RestoreUser`、`UpdateConfig`、`UpdateNickname`、`UpdatePassword`
    - `constants.ts` — 领域常量（如 JWT 存储键等）
- **`application/`** — 应用层
    - `usecases/auth-service/` — 认证用例 `AuthUseCase`（登录、注册、检入、登出等）
    - `usecases/user-service/` — 用户用例 `UserUseCase`（个人信息、昵称、密码、注销与恢复等）
    - `viewobjects/` — 视图对象：`AuthViewObject`、`UserViewObject`
    - `index.ts` — 用例装配出口

## 📁 目录结构

```text
packages/domain-identity/
└── src/
    ├── application/
    │   ├── index.ts
    │   ├── usecases/
    │   │   ├── auth-service/
    │   │   │   ├── converters.ts
    │   │   │   ├── index.ts
    │   │   │   └── usecase.ts
    │   │   ├── index.ts
    │   │   └── user-service/
    │   │       ├── converters.ts
    │   │       ├── index.ts
    │   │       └── usecase.ts
    │   └── viewobjects/
    │       ├── auth.ts
    │       ├── index.ts
    │       └── user.ts
    └── domain/
        ├── constants.ts
        ├── entities/
        │   ├── index.ts
        │   ├── user-config.ts
        │   └── user.ts
        ├── repositories/
        │   ├── auth.ts
        │   ├── index.ts
        │   ├── user-config.ts
        │   └── user.ts
        ├── services/
        │   ├── auth-service.ts
        │   ├── index.ts
        │   └── user-service.ts
        └── valueobjects/
            ├── auth-session.ts
            ├── deactive-user.ts
            ├── index.ts
            ├── restore-user.ts
            ├── signin.ts
            ├── signup.ts
            ├── update-config.ts
            ├── update-nickname.ts
            └── update-password.ts
```

## 🔗 依赖

- `@nao-todo/shared`（workspace）