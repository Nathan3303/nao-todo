# T202 服务端门禁补齐：CI + 主干分支保护（rd-be 交付报告）

- 仓库：`Nathan3303/nao-todo-server`（public）
- 分支：`nao/T202-ci`（保留未删）→ PR **#33**（squash 合并）
- main：`1a3fa23` → **`0d25f74`**（2026-09-25T05:32:06Z 合并）
- 结论：**CI 已上线并已在 main 上跑通；main 分支保护已生效（含 2 项必需检查、禁 force push、禁删除、要求 PR）**；**无需用户手动操作**。1 项决策点（`enforce_admins`）待 PM/用户确认。

## 1. CI（`.github/workflows/ci.yml`，82 行）

- 触发：`push`（仅 main）+ 所有 `pull_request`；同一 ref 旧运行自动取消。
- `build/vet/unit`：`go build ./...` → `go vet ./...` → `TZ=UTC go test ./... -count=1` → `gofmt -l`（阻断；**放在最后**，使格式债未清时前序证据仍产出）。
- `integration`：Actions `services` 起 **MySQL 8.4.9（TZ=UTC）+ Redis 8.8.0**，注入
  `NAO_TEST_MYSQL_DSN=root:dev_password@tcp(127.0.0.1:3306)/nao_todo_test?parseTime=true&loc=UTC&charset=utf8mb4`、
  `NAO_TEST_REDIS_ADDR=127.0.0.1:6379`，跑 `TZ=UTC go test -tags integration -p 1 -count=1 ./...`。
- 版本纪律：Go 固定 **1.27**（与本地一致）；**未引入 golangci-lint**（v1.64.8 解析不了 go1.27 导出数据）。
- `actions/checkout@v7` + `actions/setup-go@v7`（node24；避免首跑时的 Node.js 20 弃用注解）；module 缓存用 setup-go 自带。
- 集成测试固定 **`-p 1`**：多包 `TestMain` 各自 `AutoMigrate` 同一测试库，并行必竞态（T163 已登记）。

### run 证据

| run                                                                                   | 事件                                            | 结果                                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| [36098521528](https://github.com/Nathan3303/nao-todo-server/actions/runs/36098521528) | pull_request（checkout@v4/setup-go@v5）         | ✅ `build/vet/unit` 1m0s · `integration` 2m7s（仅 Node20 弃用注解） |
| [36098756727](https://github.com/Nathan3303/nao-todo-server/actions/runs/36098756727) | pull_request（升级 actions 后 · **PR 最终态**） | ✅ `build/vet/unit` 1m7s · `integration` 2m4s                       |
| [36098968645](https://github.com/Nathan3303/nao-todo-server/actions/runs/36098968645) | **push main**（合并后）                         | ✅ `build/vet/unit` 1m8s · `integration` 2m0s                       |

check 名（分支保护引用，逐字）：`build/vet/unit`、`integration`。

### 本地门禁（style 提交后复跑，全范围）

| 命令                                                   | rc  | 结果                                                                                                        |
| ------------------------------------------------------ | :-: | ----------------------------------------------------------------------------------------------------------- |
| `go build ./...`                                       |  0  | —                                                                                                           |
| `go vet ./...`                                         |  0  | —                                                                                                           |
| `gofmt -l .`                                           |  0  | 空                                                                                                          |
| `TZ=UTC go test ./... -count=1`                        |  0  | 20 包 / 408 例 / 0 红 / 0 skip                                                                              |
| `TZ=UTC go test -tags integration -p 1 -count=1 ./...` |  0  | 21 包 / 476 例 / 0 红 / 0 skip（一次性 MySQL 8.4.9@13306（TZ=UTC）+ Redis 8.8.0@16379，未碰生产 3306/6379） |

## 2. gofmt 存量债偿还（零语义自证）

- main 树此前 **19 文件 / 356 行** gofmt 违规（空格缩进、结构体对齐、import 组内顺序、尾部空行）——**非本单引入**；`.editorconfig` 本就要求 Go `indent_style = tab`，属本仓自身约定。
- **口径更正**：T182 回执中「`gofmt` 干净」实为**仅查变更文件**口径，不代表全仓干净。
- 自证（提交 `bf83bec`）：
    1. **二进制等价**：`./cmd` 分别在 gofmt 前/后以 `-trimpath -buildvcs=false -ldflags=-buildid=` 重建，**sha256 完全一致** = `8367015188bc2e5b59ec1f49f7228862b2a7ca2c3616eee77376b73ac04e926f`（gofmt 前另一次带 buildid 构建仅差 79 字节 = build id 区）。
    2. `git diff -w` 残留仅为 **import 行搬移（5 文件 ×1 行 = `iCtx` 归位）** 与 **2 行尾部空行**，无任何逻辑改动。
    3. 提交后全量门禁复跑全绿（见上表）。
- 提交隔离：CI 提交（`767fcae`）与 style 提交（`bf83bec`）**分开**；actions 版本升级为第三条小提交（`4f9e3e4`）；squash 后 main 上恰好 1 条提交。

## 3. 分支保护（`main`，`gh api -X PUT` 配置后 GET 自证）

```json
{
    "required_status_checks": {
        "strict": true,
        "contexts": ["build/vet/unit", "integration"],
        "checks": [
            { "context": "build/vet/unit", "app_id": 15368 },
            { "context": "integration", "app_id": 15368 }
        ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews": false,
        "require_code_owner_reviews": false
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
}
```

- `app_id 15368` = GitHub Actions ⇒ 两个必需检查确属实跑 job，非挂空。
- `enforce_admins=true`：owner/admin 也受同样约束（否则唯一协作者 = admin 可绕过，保护形同虚设）。**若不希望丧失「CI 故障时直推」的逃生口，可改为 `false`（1 条命令，见 §5）。**
- 权限情况：仓库 **public + token 具 admin** ⇒ 无需 GitHub Pro、无需用户手动操作。

## 4. 其它核实项

- `default_branch = main` ✓（`origin/HEAD -> origin/main`）。
- `arch/go-ddd` 未动（远端仍为 `a75e5a6b`）；**未删除任何分支**（含 `nao/T202-ci`）；**未 push main**（仅经 PR squash 合并）。
- 工作区干净；提交均 `--only <精确路径>`（未用 `-A`）。
- 本仓**无 `.github/pull_request_template.md`**（PM 立项时按 `.agents/templates/github/pull_request_template.md.example` 补建）⇒ 本次 PR 正文为手写，已含存量债口径更正。

## 5. 未过项 / 风险 / 决策点

| #   | 项                                                         | 说明 / 处置                                                                                                                                  |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | `enforce_admins=true`（**决策点**）                        | 为「必须过 CI + 要求 PR」的必然推论；若需逃生口：`gh api -X DELETE repos/Nathan3303/nao-todo-server/branches/main/protection/enforce_admins` |
| R-1 | `strict=true`（我的补充，未在派发中明示）                  | 「分支须与 main 同步才可合并」；如需宽松：`required_status_checks.strict=false`                                                              |
| R-2 | `nao/T202-ci` 分支保留                                     | 遵「不删任何分支」；若按 github-flow 惯例应删，需 PM 确认后 `git push origin --delete nao/T202-ci`                                           |
| R-3 | check 名与 job `name:` 强耦合                              | 日后改 CI 的 job 名**必须同步**改保护规则，否则保护挂空（已在此记录）                                                                        |
| R-4 | 未做「真实直推 main 被拒」的功能性验证                     | 依据 PM 指定的自证方式（GET 输出）；避免触碰「不 push main」红线                                                                             |
| R-5 | 剩余 annotation：`ubuntu-latest → Ubuntu 26`（2026-10-19） | 提示性，非阻断；届时确认 runner 兼容即可                                                                                                     |
| R-6 | Dependabot 13 告警（7 critical）                           | 范围外技术债，T201 已登记，本单未处理                                                                                                        |