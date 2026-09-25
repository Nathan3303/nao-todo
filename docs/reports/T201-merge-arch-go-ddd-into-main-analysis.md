# T201 · 服务端「合并式收口」第一步分析：`arch/go-ddd` → `main`

- 角色：rd-be（会话 `rd-be-T201`）
- 仓库：`/home/nathan/Project/nao-todo-server`
- 日期：2026-09-25
- 状态：**分析完成，等待 PM 放行第二步（合并）**
- 结论：**可行，且风险远低于预估**。`main` 的全部内容逐字节等于 `arch/go-ddd` 的一个历史祖先状态；合并结果应严格等于 `arch/go-ddd` 的 HEAD 树。**未发现需要仲裁的语义冲突（0 项）**；需 PM 确认的只有「用户可见契约演进」4 项与 1 项合并策略授权。

---

## §0 复核结论（与 PM 实测口径的差异）

| 项                 | PM 实测    | 本次复核                                      | 说明                                                                                        |
| :----------------- | :--------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------ |
| merge-base         | `e3736684` | ✅ `e373668448688589d5c4f0091b47cf6f88ee3042` | **`e3736684` = 旧 NestJS `arch/primitive` 分支 tip（2025-05-14）**，非「Go 时代的共同祖先」 |
| `arch/go-ddd` 领先 | 194        | ✅ 194                                        |                                                                                             |
| `main` 领先        | 44         | ✅ 44                                         | = **7 个 NestJS 期 PR merge** + **37 个 Go 提交**                                           |
| 冲突面             | ≈210 处    | **69 个文件**                                 | 210 应是旧 `merge-tree` 的 CONFLICT 行数（含 hunk / `changed in both`）；按文件去重 = 69    |

### 决定性证据（本次分析的核心）

```
origin/main        = 1ab267bc36c19f5df3b72ccfc64e86079d95529c
origin/arch/go-ddd = a75e5a6b396414f99ea8be39308b5f2990177d19

main^{tree}        = cb917b7b8bbb993b12610c0343929a2d676a4ed1
f2e2d7b^{tree}     = cb917b7b8bbb993b12610c0343929a2d676a4ed1   ← 完全相同
arch HEAD^{tree}   = 2f1e6f06420d0c55ffafc401062d29e21386135f
```

1. `f2e2d7b`（`feat: 新增用户注销功能`）= `arch/go-ddd` 的历史提交；
2. `git merge-base --is-ancestor f2e2d7b origin/arch/go-ddd` → **YES**；
3. `git rev-parse origin/main^{tree}` == `git rev-parse f2e2d7b^{tree}`（哈希级同一）；
4. `git cherry -v origin/arch/go-ddd origin/main` → **37/37 非 merge 提交全部 `-`（patch-equivalent 已存在），`+` = 0**；
5. `f2e2d7b..origin/arch/go-ddd` = **155 个后续提交**。

⇒ **`main` 的内容 = `arch/go-ddd` 的一个历史状态（逐字节），`arch` 在其上有 155 个提交的继续演进。**
⇒ 因此「丢 `main` 功能」在物理上不可能发生；真正的风险反向 —— **naive 合并会把 `main` 的 63 个已被 `arch` 删除的旧文件「复活」**（见 §4）。

### 拓扑（真实分叉点）

```
...--393bf36--7ef3dae  (main 第 7 个 NestJS PR merge)
         \        /
          e3736684  (arch/primitive tip = merge-base)
              |
          02abd37 ──── … ──── f2e2d7b ──── …(155)──── a75e5a6b (arch HEAD)
        (arch 起线)        (== main 内容)          (目标主干)
```

`main` 的 7 个 merge 是 **PR #22/#24–#29（`arch/primitive` → `main`）**，全部是 NestJS 期（`apps/`、`packages/`）改动；其内容已完整包含在 `e3736684`（即 `arch` 的基线）中，且 NestJS 目录在两侧均已被 `arch(clear)` 删除 ⇒ **无需保留**。

---

## §1 `main` 独有的 44 提交清单

### 组 A：NestJS 期 PR merge（7 个，全部无需保留）

| #   | commit    | 说明                                | 触及                                    |
| :-- | :-------- | :---------------------------------- | :-------------------------------------- |
| 1   | `1bb7d9a` | Merge PR #22 from arch/primitive    | `apps/web/jenkins.build.sh`             |
| 2   | `b35cc00` | Merge PR #24                        | `apps/`, `packages/`, `package.json` …  |
| 3   | `2a2bd9d` | Merge PR #25                        | `packages/models`, `packages/pipelines` |
| 4   | `ab18717` | Merge PR #26                        | `packages/apis/src/user/update.ts`      |
| 5   | `2975af9` | Merge PR #27                        | `packages/apis/src/user/update.ts`      |
| 6   | `393bf36` | Merge PR #28                        | `packages/utils/src/save-avatar.ts`     |
| 7   | `7ef3dae` | Merge PR #29（**p2 = `e3736684`**） | `packages/apis/src/user/update.ts`      |

判定依据：`apps/`、`packages/` 在 `origin/main` 与 `origin/arch/go-ddd` 的 HEAD 树中**均不存在**（`git ls-tree` 无命中）；内容已被 `arch(clear)` 删除，且等价内容已在 `e3736684` 之内。

### 组 B：Go 提交（37 个，全部 patch-equivalent 已存在于 arch）

| #   | commit    | 主题                              | #   | commit    | 主题                              |
| :-- | :-------- | :-------------------------------- | :-- | :-------- | :-------------------------------- |
| 8   | `9fa03eb` | optimize(avatar) 头像上传格式处理 | 27  | `4996460` | 移除 todoIdRaw 规则匹配           |
| 9   | `36b27bb` | jenkins(sh) 更新部署脚本          | 28  | `56435bf` | 待办任务**复制**功能接口          |
| 10  | `62867d8` | arch(clear) 删除所有旧架构文件    | 29  | `91fda09` | **标签偏好设置**更新接口          |
| 11  | `f2fd121` | 引入基础 Golang 项目模板          | 30  | `9220438` | 修复获取单个清单逻辑错误          |
| 12  | `7c9e90d` | 用户 + 项目（清单）API            | 31  | `cedd188` | 修复任务状态/优先级数值转换       |
| 13  | `f9e0103` | 进一步完善清单 API                | 32  | `efcb6d8` | 多 Event 批量更新 API             |
| 14  | `c4702d9` | 基础标签 API                      | 33  | `a341cfe` | CORS + 本地数据库地址             |
| 15  | `61ca884` | 修复清单列表查询条件              | 34  | `2b92f27` | DDD 重构缓存                      |
| 16  | `a398667` | modules → models 包名             | 35  | `223f08d` | DDD 重构缓存 #2                   |
| 17  | `b9e3d21` | 基础待办 API                      | 36  | `0678dfb` | DDD 重构缓存 #3                   |
| 18  | `acc484d` | 恢复待办 Restore API              | 37  | `381108a` | 完善 Auth 全域 + User 部分接口    |
| 19  | `4a9aa98` | 基础检查事项 API                  | 38  | `284d8ec` | User 域**更新头像**接口           |
| 20  | `5bed67d` | 修复部分更新更新时间              | 39  | `b38c15e` | 清单领域部分接口                  |
| 21  | `c9d3b29` | 基础评论 API                      | 40  | `b56deb8` | 标签域 + 待办任务域部分接口       |
| 22  | `bce5708` | 修复更新 API 返回 Data            | 41  | `6831dc1` | 检查事项 + 任务评论领域接口       |
| 23  | `070717e` | 优化部分接口执行逻辑              | 42  | `3196159` | **客户端信息上下文（JWT 校验）**  |
| 24  | `3804fd6` | 优化部分接口执行逻辑 #2           | 43  | `aadcb2a` | **用户模型字段**并实现填充        |
| 25  | `7ea2fde` | 优化部分接口执行逻辑 #3           | 44  | `bb6f777` | **用户请求限流阈值中间件**        |
| 26  | —         | —                                 | —   | `1ab267b` | **新增用户注销功能**（main HEAD） |

---

## §2 对照表（`main` 能力 → `arch/go-ddd` 实现 → 判定）

> 判定口径：**已覆盖** = 能力存在（可能重写/更名/演进）；**已覆盖+增强** = 存在且更完整。**「未覆盖需保留」= 0 项**。

| #   | `main` 提交（能力）                                               | `main` 实现位置                                                                                                                          | `arch/go-ddd` 对应实现                                                                                                                                                                                                             | 判定                                       | 依据                                                                                                                                                                                   |
| :-- | :---------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 7 个 NestJS PR merge                                              | `apps/`, `packages/`                                                                                                                     | —— （NestJS 架构整体退役）                                                                                                                                                                                                         | **无需保留**                               | 两侧 HEAD 均无 `apps/`、`packages/`；内容 ⊆ `e3736684`                                                                                                                                 |
| B1  | 模板 / 项目骨架（`f2fd121`…）                                     | 根目录分层                                                                                                                               | 同分层（`cmd/ conf/ consts/ domain/ application/ infrastructure/ interfaces/`）                                                                                                                                                    | 已覆盖+增强                                | `arch` 另有 `.example/`、`docker-compose*.yml`、`Dockerfile`、`.golangci.yml`、`scripts/`                                                                                              |
| B2  | 头像上传/格式处理（`9fa03eb`,`284d8ec`）                          | `controllers/user.go: UpdateUserAvatarHandler`                                                                                           | `interfaces/controllers/user.go: UpdateUserAvatar` + `GetAvatar`（JWT 保护的 `/static/uploads/avatars/:filename`）+ `application/user/avatarStorage.go` + `infrastructure/storage/avatarStorage.go`                                | **已覆盖+增强**                            | 路由 `PUT /user/avatar` 存在；新增鉴权访问与存储抽象                                                                                                                                   |
| B3  | Auth 全域 + User 接口（`381108a`）                                | `domain/auth/*`、`controllers/auth.go`、`types/auth.go`                                                                                  | `domain/identity/*`、`interfaces/controllers/identity.go`、`interfaces/types/identity.go`、`routers/authRouter.go`                                                                                                                 | **已覆盖**（域更名为 identity）            | `POST /auth/signin                                                                                                                                                                     | signup`、`PUT /auth/checkin`、`DELETE /auth/signout`、`GET /auth/validate` 全部存在 |
| B4  | **客户端信息上下文 / JWT 校验**（`3196159`）                      | `middlewares/clientInfo.go`、`domain/auth/vo/jwtClaims.go`、`infrastructure/context/*`                                                   | `interfaces/middlewares/clientInfo.go`（含 `getClientType`、`DeviceId`）、`domain/identity/valueobjects/jwtClaims.go`、`infrastructure/context/clientIP.go`、`userId.go`                                                           | **已覆盖**                                 | 符号逐一存在                                                                                                                                                                           |
| B5  | **用户模型字段**（`aadcb2a`）                                     | `domain/user/entities/user.go`、`models/user.go`                                                                                         | `domain/identity/entities/user.go`（`Avatar/CreatedFrom/Role/State/DeactivedAt`）、`domain/identity/entities/userConfig.go`                                                                                                        | **已覆盖**                                 | 字段存在（`Role`/`State` 类型被 arch 改为枚举，见 §5-D2）                                                                                                                              |
| B6  | **限流阈值中间件**（`bb6f777`）                                   | `middlewares/rateLimit.go`、`domain/auth/repositories/rateLimite.go`、`infrastructure/persistence/auth/rateLimitRepoImpl.go`             | `interfaces/middlewares/rateLimit.go`（签名 `RateLimiter(auth, limit, tag)`）、`domain/identity/repositories/rateLimit.go`、`infrastructure/persistence/identity/rateLimitRepoImpl.go`                                             | **已覆盖+增强**                            | 全站已接线，并按路由分桶配额（`auth-signin=8` / `auth=8` / `projects=32` / `tags=32` / `comments=32` / `events=64` / `tasks=48` / `tasks-read=400`）                                   |
| B7  | 清单域接口（`f9e0103`,`61ca884`,`9220438`,`b38c15e`）             | `domain/project/*`、`controllers/project.go`                                                                                             | `domain/project/*`（含 `entities/projectPreference.go`、`valueobjects/saveProjectPreference.go`）、`interfaces/routers/projectRouter.go`                                                                                           | **已覆盖+增强**                            | 路由齐备：`GET /`、`GET /:id`、`POST /`、`PUT /`(批量)、`PUT /:id`、`DELETE /:id`、`PUT /restore/:id`、`PUT /archive/:id`、`PUT /unarchive/:id`、**`GET/POST /:projectId/preference`** |
| B8  | 标签域（`c4702d9`）                                               | `domain/tag/*`、`controllers/tag.go`                                                                                                     | `domain/tag/*`、`interfaces/routers/tagRouter.go`                                                                                                                                                                                  | **已覆盖+增强**                            | `GET /`、`GET /:id`、`POST /`、`PUT /`(批量)、`PUT /:id`、`DELETE /:id`                                                                                                                |
| B9  | **标签偏好设置**（`91fda09`）                                     | `controllers/tag.go: UpdateTagPreferenceHandler`（**`main` 的 `routers.go` 未注册该路由**）                                              | `domain/tag/entities/tagPreference.go`、`repositories/tagPreference.go`、`valueobjects/saveTagPreference.go`、`routers/tagRouter.go: GET/POST /:tagId/preference`                                                                  | **已覆盖+补全**                            | `main` 侧该 handler 在终态是**未接线的死代码**；`arch` 已正确接线（`GetTagPreference`/`UpdateTagPreference`）                                                                          |
| B10 | 待办任务域（`b9e3d21`,`acc484d`,`56435bf`）                       | `domain/task/*`、`controllers/task.go`                                                                                                   | `domain/task/*`、`interfaces/routers/taskRouter.go`                                                                                                                                                                                | **已覆盖+增强**                            | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id`、`PUT /restore/:id`、**`POST /copy/:taskId`**、`POST /:taskId/snooze`                                                         |
| B11 | 检查事项域（`4a9aa98`,`efcb6d8`）                                 | `domain/event/*`、`controllers/event.go`、`types/event.go`                                                                               | `domain/task/entities/taskCheckItem.go`、`repositories/checkitem.go`、`application/task/checkitem_app.go`、`controllers/event.go`、`routers/eventRouter.go`                                                                        | **已覆盖**（归入 task 子域）               | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id`、**`PUT /`（批量）**                                                                                                          |
| B12 | 评论域（`c9d3b29`,`6831dc1`）                                     | `domain/comment/*`、`controllers/comment.go`                                                                                             | `domain/task/entities/taskComment.go`、`repositories/comment.go`、`application/task/comment_app.go`、`controllers/comment.go`、`routers/commentRouter.go`                                                                          | **已覆盖**                                 | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、**`DELETE /:id`**                                                                                                                           |
| B13 | **用户注销功能**（`1ab267b`）                                     | `PUT /user/deactive`、`PUT /user/active`；`domain/user` Deactive/Active；`infrastructure/cron/deleteInactiveUser.go`；`User.DeactivedAt` | `DELETE /user/`（`DeleteUser`）、`PUT /user/restore`（`RestoreUser`）；`domain/identity/entities/user.go: DeactivedAt` + `IsDeactived()`；`infrastructure/cron/deleteInactiveUser.go`；`application/user` `DeleteDeactivatedUsers` | **已覆盖**（接口形态与窗口变化，见 §5-D1） | 能力等价：注销 → 记录时间 → 窗口内可恢复 → 定时任务清理                                                                                                                                |
| B14 | 零值更新 / 时间解析（`5bed67d`）                                  | `infrastructure/utils/timeParser.go`                                                                                                     | `domain/types/nullableTime.go`（`417b698 refactor` 重构为 `NullableTime` 值类型）                                                                                                                                                  | **已覆盖+重构**                            | `NullableTime` 承担原 `timeParser` 语义，并解决零值更新                                                                                                                                |
| B15 | CORS / 本地配置（`a341cfe`）                                      | `conf/config.yaml.example`                                                                                                               | `conf/config.yaml` + `.example/app.config.yaml.example`（`417b698` 调整示例配置）                                                                                                                                                  | **已覆盖**                                 | 示例配置规范化；`main` 的 `.example` 为旧名                                                                                                                                            |
| B16 | Jenkins 脚本（`36b27bb`）                                         | `apps/web/jenkins.build.sh`                                                                                                              | `Dockerfile` + `docker-compose.yml` + `scripts/`                                                                                                                                                                                   | **已覆盖**（部署形态变为容器化）           | NestJS 脚本随架构退役；部署能力由容器化承接                                                                                                                                            |
| B17 | `consts/user.go`（`aadcb2a` 附带）                                | `consts/user.go`                                                                                                                         | `consts/consts.go`                                                                                                                                                                                                                 | **已覆盖**                                 | `main` 的 `consts/user.go` 内容仅 `package consts`（无实体）；`arch` 的 `consts/consts.go` 含雪花纪元常量                                                                              |
| B18 | `.idea/*`（IDE 工程文件）                                         | `.idea/{.gitignore,modules.xml,*.iml,vcs.xml}`                                                                                           | 已删除                                                                                                                                                                                                                             | **有意清理，非能力丢失**                   | `arch` 提交 `5415617 chore: 清理项目无关配置文件并调整示例配置`                                                                                                                        |
| B19 | 域文档（`docs/auth.md`、`user.md`、`project.md`、`*.excalidraw`） | `docs/*`                                                                                                                                 | `docs/excalidraws/`、`docs/devlogs/`、`docs/plans/`、`docs/fix-reports/`、`docs/*-report.md`                                                                                                                                       | **已覆盖**（重组）                         | `docs/ddd.excalidraw` → `docs/excalidraws/ddd.excalidraw` 为逐字节同一 blob                                                                                                            |

### 判定汇总

- **已覆盖 / 已覆盖+增强：19 簇（B1–B19）**
- **无需保留：1 簇（A1，NestJS 期）**
- **未覆盖需保留：0 项** → 因此第二步**无需**逐项回归脚本；回归证据 = 全范围门禁 + 路由清单对照（§6）
- **语义冲突需裁决：0 项**（原因见 §3.3）

---

## §3 冲突热点（69 文件按目录聚类）

### 3.1 构成

| 类型                                                  | 数量   | 文件                          |
| :---------------------------------------------------- | :----- | :---------------------------- |
| **add/add**（共同祖先 NestJS 无此文件，两侧各自新建） | **67** | 见下                          |
| **modify/modify**（两侧均修改了 NestJS 期已有文件）   | **2**  | `.editorconfig`、`.gitignore` |
| 合计                                                  | **69** |                               |

```
14  infrastructure/persistence   (models/ + project|tag|task 的 converters/repoImpl + dbs/)
 6  interfaces/controllers        (comment, event, project, tag, task, user)
 5  interfaces/types              (project, responseData, tag, task, user)
 4  domain/task                   (entities/task, repositories/task, service/service, serviceImpl)
 4  domain/tag                    (entities/tag, repositories/tag, service/*)
 4  domain/project                (entities/project, repositories/project, service/*)
 3  interfaces/middlewares        (clientInfo, jwtValidator, rateLimit)
 3  infrastructure/cron           (cron.go, cronImpl.go, deleteInactiveUser.go)
 3  application/user              (app, appImpl, converters)
 3  application/task              (app, appImpl, converters)
 3  application/tag               (app, appImpl, converters)
 3  application/project           (app, appImpl, converters)
 3  application/auth              (app, appImpl, converters)
 3  (root)                        (.editorconfig, .gitignore, go.mod)
 2  infrastructure/context        (clientIP.go, userId.go)
 1  infrastructure/ip2region / auth / initialize.go
 1  conf/config.yaml  1  conf/config.go  1  cmd/main.go
```

### 3.2 冲突成因（一句话）

merge-base = **NestJS 仓库**（`apps/`、`packages/`）。两侧都「删除 NestJS + 各写一套 Go」，于是在相同路径上各自新建/修改 ⇒ git 报 add/add 与 modify/modify。**与功能取舍无关**。

### 3.3 语义冲突判定：**0 项**

判定逻辑：`main` 的树 == `arch` 的祖先 `f2e2d7b` 的树（§0）。因此对任一共享路径，`main` 侧的内容**就是 `arch` 自己在该文件的早期版本**；不存在「两边对同一能力给出互相竞争、各有道理的实现」。`arch` 侧一律是该能力的后继版本 ⇒ **逐文件「取 `arch` 侧」在语义上必然正确**。

需要 PM/用户确认的**不是**冲突，而是 `arch` 在 155 个后续提交中做出的 **4 项用户可见契约演进**（见 §5）。

---

## §4 ⚠️ 真正的风险：naive 合并会「复活」63 个幽灵文件

### 4.1 现象（实测）

merge-base 无 Go 文件 ⇒ 对「`main` 新增、`arch` 净效果为不存在」的文件，git 三分法判为 _added by us, untouched by them_ ⇒ **静默保留 `main` 版本，且不报冲突**。

实测（`git worktree` 内真实 merge，冲突全部按 `arch` 侧解决后）：

```
main-only 文件中在合并结果里"存活"的数量 = 63 / 63   ← 全部复活
```

复活清单（节选，完整 63 项）：

- 旧域：`domain/auth/**`(9)、`domain/comment/**`(5)、`domain/event/**`(4)、`domain/user/**`(6)
- 旧应用层：`application/comment/**`(3)、`application/event/**`(3)
- 旧基础设施：`infrastructure/persistence/{auth,comment,event,user}/**`(11)、`models/{comment,event,session}.go`、`utils/timeParser.go`
- 旧接口层：`interfaces/initialize/routers.go`（**第二套 `InitRouters`**）、`interfaces/types/{auth,comment,event}.go`
- 项目无关：`.idea/*`(4)、`conf/config.yaml.example`、`consts/user.go`、`docs/*`

### 4.2 危害（实测：**编译失败**）

```
$ go build ./...
# naotodoserver/interfaces/types
interfaces/types/identity.go:4:6: SignInReq redeclared in this block
	interfaces/types/auth.go:3:6: other declaration of SignInReq
... （SignInRes / SignUpReq / SignOutReq / SignOutRes / CheckInReq / CheckInRes 同类）
# naotodoserver/infrastructure/persistence/user
infrastructure/persistence/user/converters.go:16:11: cannot use e.Role (variable of type string) as uint8 ...
infrastructure/persistence/user/converters.go:47:4:  u.State undefined (type *models.UserConfig has no field or method State)
...
=> 13 处编译错误，2 个包
```

⇒ **「能保留则保留」的直觉解冲突法在本例会直接产出不可编译的树**，并夹带一整层影子架构。

### 4.3 结论

> **合并策略不能是「逐文件解冲突、能保留则保留」，必须是「结果树强制等于 `arch/go-ddd` 的 HEAD 树」。**

这同时满足「不丢功能」——因为 `main` 的每一字节都已包含在 `arch` 的历史里（§0 证据 1–5）。

---

## §5 需 PM / 用户确认的 4 项（**不是阻塞项，但均为用户可见**）

| 编号   | 项                                      | `main`                                           | `arch/go-ddd`（采纳后生效）                                                              | 影响面           | 建议                                                                                                        |
| :----- | :-------------------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------- | :--------------- | :---------------------------------------------------------------------------------------------------------- |
| **D1** | 用户注销/恢复的**接口形态**             | `PUT /api/user/deactive`、`PUT /api/user/active` | `DELETE /api/user/`、`PUT /api/user/restore`                                             | 前端账号注销调用 | 采纳 `arch`（新主干既有契约）；请确认前端是否已/将适配                                                      |
| **D2** | 注销**恢复窗口**                        | 15 天（`1ab267b` 描述）                          | **7 天**（`DeleteUser` 提示「账户数据将在 7 天后自动删除」）                             | 业务规则         | 采纳 `arch`；若 7 天非期望值，另开需求改回                                                                  |
| **D3** | `User.Role` / `User.State` **字段类型** | `string` / `int8`                                | 枚举（`uint8` 底层，`UserRole`/`UserState`）                                             | 与前端 DTO 契约  | 采纳 `arch`（类型更安全，`consts` 收敛）                                                                    |
| **D4** | **CORS 白名单**                         | `localhost:5173/4173`、`localhost`               | `localhost:5173/5174`、`todo.nathanao.space`、`todobe.nathanao.space` + `X-Device-Id` 头 | 跨域可用性       | 采纳 `arch`（生产域名已就位）；如 `4173`/`localhost` 仍需保留，请指示，我可**另行**追加（不属本次合并范围） |

> 另：`arch` 的限流**配额**与 `main` 不同（按路由分桶，见 B6）——属 `arch` 期内既有设计，无需裁决，仅告知。

---

## §6 第二步执行方案（待放行）+ 验收判据

### 6.1 分支与合并（保留 merge commit）

```bash
# 0) 隔离：当前 worktree 停在 feat/99-archive-server（WIP，195 提交），不打扰。
#    用独立 worktree 建合并分支（也便于 dry-run 复核）
git fetch --all
git worktree add /tmp/t201-merge -b merge/arch-go-ddd-into-main origin/main
cd /tmp/t201-merge

# 1) 记录 merge 状态（保留 merge commit），但**不**采用其工作树
git merge --no-commit --no-ff origin/arch/go-ddd

# 2) 强制结果树 = arch HEAD（消除 63 个幽灵文件）——决定性一步
git read-tree --reset -u origin/arch/go-ddd

# 3) 提交（MERGE_HEAD 仍在 ⇒ 双亲 merge commit）
git commit -m "merge(baseline): 合入 arch/go-ddd 至 main，历史积压追平

保留 main 为唯一主干，merge commit 保留两侧完整历史。
结果树严格等于 arch/go-ddd (= a75e5a6b)，无夹带。
白名单：历史积压追平的 baseline 合并（nao-todo/AGENTS.md §GitHub flow 唯一例外）。
经核：main 内容逐字节等于 arch 历史提交 f2e2d7b 的树（37/37 提交 patch-equivalent）。"
```

**验收判据（沿用本项目 baseline 先例「diff 为空 = 无夹带」）**

```bash
git diff --stat origin/arch/go-ddd HEAD   # 必须为空
git log -1 --format='%p' HEAD             # 必须恰为 2 个父（origin/main 与 origin/arch/go-ddd）
```

### 6.2 全范围门禁（合并后，在合并分支上跑）

| #   | 命令                                                   | 说明                          |
| :-- | :----------------------------------------------------- | :---------------------------- |
| 1   | `go build ./...`                                       |                               |
| 2   | `go vet ./...`                                         |                               |
| 3   | `go test ./... -count=1`                               | 单测（arch 侧 53 个测试文件） |
| 4   | `TZ=UTC go test -tags integration -p 1 -count=1 ./...` | 15 个 integration-tagged 文件 |

**环境可行性（已实测确认，非假设）**：

- `go version go1.27.0`（`go.mod` 要求 1.25.0 → 满足）
- Docker daemon **可用**；镜像 `mysql:8.4.9` **已本地缓存**；**3307 端口空闲**
- 集成测试默认 DSN = `root:dev_password@tcp(127.0.0.1:3307)/nao_todo_test`（可用 `NAO_TEST_MYSQL_DSN` 覆盖）
- ⇒ 按测试文件注释的一次性容器recipe 启动 `mysql:8.4.9` 于 3307 即可；Redis `127.0.0.1:6379` **已在运行**（`naotodo-redis`）
- ⇒ **无阻塞**；门禁将给出精确数字（文件数/例数/红数）

> 注：本地另有常驻容器 `naotodo-mysql`(3306)/`naotodo-redis`(6379)/`naotodo-server`(3302)。集成测试默认走 **3307 一次性容器**（隔离），不会污染开发库。

### 6.3 交付

- 分支：`merge/arch-go-ddd-into-main` + push
- PR：base `main`，**merge commit**，填 PR 模板（本地无 `.github/pull_request_template.md` ⇒ 用 `nao-todo/.agents/templates/github/pull_request_template.md.example` 结构），正文**必须写明白名单例外与原因**
- **不自行合并**，等 PM 授权
- ⛔ 不动 `arch/go-ddd`、⛔ 不删任何分支

---

## §7 需 PM 放行的关键点（blocking gates）

| #      | 决策点                                                                                                                                             | 我的建议   |
| :----- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **G1** | **授权合并策略 = 「结果树强制等于 `arch/go-ddd` HEAD」**（而非「能保留则保留」逐文件解冲突）。理由见 §4：后者产出 63 个幽灵文件 + 编译失败 13 错。 | 授权该策略 |
| **G2** | 确认 D1–D4 四项**用户可见契约演进**（注销接口/窗口 7 天/枚举类型/CORS 白名单）接受以 `arch` 为准                                                   | 接受       |
| **G3** | 白名单登记：本次为「历史积压追平的 baseline 合并」⇒ 允许 merge commit（`nao-todo/AGENTS.md` 唯一例外），其后严格 squash；PR 正文注明               | 确认       |
| **G4** | 处置方式：用**独立 worktree** 建合并分支，避免打扰当前 `feat/99-archive-server`（195 提交 WIP 检出）                                               | 确认       |

> **G1/G2 是硬闸门**：未确认前我不动手合并。

---

## 附：本次分析所用命令（可复现）

```bash
git fetch --all
git merge-base origin/main origin/arch/go-ddd              # e3736684…
git rev-list --left-right --count origin/main...origin/arch/go-ddd   # 44  194
git log --oneline --reverse origin/arch/go-ddd..origin/main          # 44 提交
git cherry -v origin/arch/go-ddd origin/main                        # 37×'-'，0×'+'
git rev-parse origin/main^{tree} origin/arch/go-ddd^{tree}
git rev-parse f2e2d7b^{tree}                                # == main^{tree}
git merge-base --is-ancestor f2e2d7b origin/arch/go-ddd     # YES
git merge-tree --write-tree origin/main origin/arch/go-ddd  # 69 冲突文件
git worktree add --detach /tmp/mgtest origin/main && cd /tmp/mgtest && git merge origin/arch/go-ddd
git ls-files -u | wc -l
go build ./...                                              # naive 解冲突 ⇒ 13 错
git read-tree -u --reset origin/arch/go-ddd && git write-tree   # == arch tree
```

---

# §8 第二步执行结果（已执行，2026-09-25）

## 8.1 前置检查结论

### 检查 1：客户端兼容性 → **(a) 客户端不依赖旧契约，直接合并**

在 `nao-todo` 仓**只读**排查结果：

| 排查项                                      | 结论                          | 证据                                                                                                                                                                                                                                                               |
| :------------------------------------------ | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 旧注销端点 `PUT /user/deactive` / `/active` | **零命中**（无调用）          | 全仓 `grep -rn 'user/deactive\|user/active'` 无业务命中                                                                                                                                                                                                            |
| 客户端实际调用                              | **已是 arch 契约**            | `persistence-go/identity/user-repo-impl/impl.ts:152` `requester.delete('/user/')`；`:171` `requester.put('/user/restore')`                                                                                                                                         |
| 响应码对齐                                  | **完全一致**                  | 客户端期望 `10090`（注销成功）/`10100`（激活成功）＝ arch 控制器码；main 旧线为 `PUT /user/deactive` 路由，客户端调用会 404                                                                                                                                        |
| D2 7 天                                     | **客户端已是 7 天**           | `persistence-local/deletion/deletion-service.ts:10`「注销反悔期天数（与后端一致：注销后 7 天内可恢复）」；`local-database.ts:261`「注销成功时间 + 7 天」；locale `settings.deactive.*`「7天后被永久删除」                                                          |
| `deactivedAt` 语义                          | **与 arch 的 `+7d` 精确吻合** | `info-viewer/info.vue:17` `dayjs(deactivedAt).subtract(7,'days')` ⇒ 客户端把 `deactivedAt` 当作**删除截止时间**；arch `application/user/converters.go` `res.DeactivedAt = deactivedAt.Add(24*7h)` —— 若用 main 的裸时间，客户端日期会算错                          |
| D3 JSON 线形态                              | **兼容**                      | arch `interfaces/types/user.go` `GetUserProfileRes{ Role string `json:"role"`; State uint8 `json:"state"` }` ⇒ `role: string` / `state: number`；客户端 `persistence-go/models/user.ts` 期望 `role: string` / `state: number`                                      |
| D3 语义偏差（附带发现）                     | **零实际影响**                | 客户端 `domain-identity/entities/user.ts:30-36` `isAdmin: state===1` / `isVIP: state===2` 把 `state` 当角色；arch `state` 是账户状态（`UserStateActive=0`/`UserStateDeactivated=1`）⇒ **合并前既有不一致**；`grep -rn 'isAdmin\|isVIP'` 全仓**仅定义处、无使用点** |
| `role` 消费                                 | 无逻辑消费                    | 仅 `converters.ts:28` → `viewObject.role` 透传                                                                                                                                                                                                                     |

### 检查 2：D2（15 天 → 7 天）合法性 → **有意为之，非历史漂移**

- 引入提交：**`fc96c11 feat(user): 实现完整的用户账户注销功能`**（2026-07-21，Nathan3303）
- 提交信息明确：**「调整定时任务冷却期为7天，同步更新删除注销用户的定时任务配置」**
- 附 spec `.trae/specs/user-delete-account/spec.md`：**「冷却期固定为7天，不支持自定义」**、`TR-5.2 预计删除时间 = DeactivedAt + 7天`
- 代码一致：`infrastructure/initialize.go` `cron.NewDeleteDeactivedUserJob(7, svc.User)`（main 旧线为 `15`）+ `application/user/converters.go` 的 `+24*7h`
- 该提交还**新增**了 main 没有的能力：注销后立即清理全部会话、已注销用户禁止访问、级联清理关联数据
- ⇒ **结论：有意为之，无需停下；D2 以 arch 为准**

## 8.2 合并执行

| 项                                 | 值                                                                              |
| :--------------------------------- | :------------------------------------------------------------------------------ |
| 分支                               | `merge/arch-go-ddd-into-main`                                                   |
| 合并提交                           | **`97f0fd5e4e5fe5607d654a3908df8edc4c091c72`**                                  |
| 双亲                               | `97f0fd5^1 = 1ab267b`（合并前 `main`）· `97f0fd5^2 = a75e5a6`（`arch/go-ddd`）  |
| 结果树                             | `2f1e6f06420d0c55ffafc401062d29e21386135f` = `arch/go-ddd^{tree}` ✅            |
| `git diff HEAD origin/arch/go-ddd` | **空**（无夹带）✅                                                              |
| 63 个 main-only 幽灵文件复活数     | **0 / 63** ✅                                                                   |
| 远端                               | `refs/heads/merge/arch-go-ddd-into-main = 97f0fd5e…`（push 成功，非 `--force`） |
| `origin/main`                      | `1ab267b`（**未改动**）✅                                                       |

## 8.3 四条全范围门禁（精确数字）

| #   | 命令                                                                | exit  | 包数 / 例数 / 红数                |
| :-- | :------------------------------------------------------------------ | :---- | :-------------------------------- |
| 1   | `go build ./...`                                                    | **0** | —                                 |
| 2   | `go vet ./...`                                                      | **0** | 0 条输出                          |
| 3   | `TZ=UTC go test ./... -count=1`（`-v` 计数）                        | **0** | 20 包 / **408** / **0**（0 skip） |
| 4   | `TZ=UTC go test -tags integration -p 1 -count=1 ./...`（`-v` 计数） | **0** | 21 包 / **476** / **0**（0 skip） |

集成环境（一次性容器，已回收，未触碰开发库 3306）：

- MySQL `mysql:8.4.9` @ `127.0.0.1:3307`（`NAO_TEST_MYSQL_DSN`，库 `nao_todo_test`）
- Redis `redis:8.8.0` @ `127.0.0.1:6380`（`NAO_TEST_REDIS_ADDR`，**0 条降级警告**）
- `go1.27.0` · `TZ=UTC`

## 8.4 PR

- **PR #32**：https://github.com/Nathan3303/nao-todo-server/pull/32
- base `main` ← head `merge/arch-go-ddd-into-main`；**Draft**；`MERGEABLE` / `CLEAN`
- 365 files changed, +34094 / −6032
- 正文含：① 白名单例外声明与依据 ② `main ⊂ arch` 证据（tree ≡ · cherry 37/37 `-`）③ D1–D4 契约演进 + 客户端兼容性结论 ④ 四项门禁数字 ⑤ 幽灵文件 0/63 自证 ⑥ 风险/回滚
- **未合并**（等 PM 授权）；`arch/go-ddd` **未删除**；未动任何其它分支

## 8.5 遗留提示（不阻塞）

- 客户端 `domain-identity/entities/user.ts` 的 `isAdmin: state===1` / `isVIP: state===2` 与后端 `state`（账户状态）语义不一致 —— **合并前既有**、当前无使用点，建议另行跟进（PM 登记为 `DEF-39`）。

## 8.6 合并落地结果（PM 授权后已执行，2026-09-25T05:13:12Z）

| 项                                        | 值                                                                            |
| :---------------------------------------- | :---------------------------------------------------------------------------- |
| PR #32                                    | **MERGED**（`gh pr ready 32 && gh pr merge 32 --merge`，非 squash，未删分支） |
| GitHub 生成的合并提交                     | **`1a3fa23118e0ce00727291f4e5b62afcc57a9345`**                                |
| **`origin/main` HEAD**                    | **`1a3fa23118e0ce00727291f4e5b62afcc57a9345`**（`Merge pull request #32 …`）  |
| `origin/main` 双亲                        | `1ab267b`（合并前 main）+ **`97f0fd5`**（本次手工 merge commit）              |
| `origin/main^{tree}`                      | `2f1e6f06420d0c55ffafc401062d29e21386135f` = `arch/go-ddd^{tree}` ✅          |
| `git diff origin/main origin/arch/go-ddd` | **空**（无夹带）✅                                                            |
| 幽灵文件复活                              | **0 / 63** ✅                                                                 |

### 血缘完整性（逐项验证）

```
1ab267b (合并前 main) ──┬──────────────────────────────────────┐
                        │                                      │
                        └── 97f0fd5 (手工 merge commit) ───────┴── 1a3fa23  ← origin/main (新 HEAD)
a75e5a6 (arch/go-ddd) ──┘
```

- `1ab267b`（合并前 main）在 `origin/main` 历史内 ✅
- `a75e5a6`（`arch/go-ddd` tip）在 `origin/main` 历史内 ✅
- `97f0fd5`（手工 merge commit）在 `origin/main` 历史内 ✅

> **偏差说明（诚实登记）**：GitHub 的 “Create a merge commit” **不会**在 base 为 head 祖先时快进，而是**再生成一层 merge commit**（`1a3fa23`，双亲 = `1ab267b` + `97f0fd5`）。因此 `main` 上本次 baseline 出现 **2 个合并提交**（`97f0fd5` 与 `1a3fa23`）。
>
> - 影响：**无**。结果树 = arch 树，两侧历史完整，白名单例外（“允许 merge commit”）未被突破。
> - 若要压成单层，只能改写 `main` 并 force push——**项目红线禁止 push main**，建议接受现状。

### 分支保留（均未删除）

| 分支                          | 远端 SHA                                   | 状态              |
| :---------------------------- | :----------------------------------------- | :---------------- |
| `main`                        | `1a3fa23`                                  | 新 HEAD ✅        |
| `arch/go-ddd`                 | `a75e5a6b396414f99ea8be39308b5f2990177d19` | **保留为历史** ✅ |
| `merge/arch-go-ddd-into-main` | `97f0fd5e4e5fe5607d654a3908df8edc4c091c72` | 保留 ✅           |

门禁 1:1 可继承：`origin/main` 的树哈希与我跑过四条门禁的树**逐字节相同**（`2f1e6f06…`），故门禁结论对 `main` 直接有效。