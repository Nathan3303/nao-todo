// desktopapp 装配层：UI 组合式函数从 webapp 复用；
// usecases 共享 webapp 单一真源（apps/web/src/hooks/usecases），端差异经 ./usecases/binding 注入
// （本地 IndexedDB 加密存储 + 本地数据解锁），不再复制 usecase 实现。
export * from '@nao-todo/webapp/src/hooks/use-auto-change-theme'
export * from '@nao-todo/webapp/src/hooks/use-keyboard-shortcuts'
export * from '@nao-todo/webapp/src/hooks/use-scope'
export * from '@nao-todo/webapp/src/hooks/use-shortcut'
export * from '@nao-todo/webapp/src/hooks/use-sync-status'
export * from '@nao-todo/webapp/src/hooks/use-manual-sync'
export * from '@nao-todo/webapp/src/hooks/use-mirror-loaded-count'
export * from './usecases'