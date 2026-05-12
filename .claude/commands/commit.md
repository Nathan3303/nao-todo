请阅读 `.trae/rules/git-commit-message.md` 文件中的 Git 提交消息规范，然后检查当前暂存的文件变更（`git diff --cached` 和 `git diff --cached --stat`），并查看最近的提交历史（`git log --oneline -10`）以了解提交风格。

根据规范生成符合格式的提交消息，并完成暂存文件的 `git commit`。注意：
- 按规范中的格式选择正确的 type 前缀（feat|fix|chore|change）
- 变更点尽量列在变更点列表中，配置文件修改放在"其他"部分
- 避免重复描述
