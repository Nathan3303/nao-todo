<script setup lang="ts">
import { ProjectSmartList } from '@nao-todo/presentation/project'
import { TagSmartList } from '@nao-todo/presentation/tag'
import {
    PROJECT_CREATOR_DIALOG_KEY,
    PROJECT_MANAGER_DIALOG_KEY,
    TAG_CREATOR_DIALOG_KEY,
    TAG_MANAGER_DIALOG_KEY
} from '@nao-todo/shared/constants'
import dayjs from 'dayjs'
import { t } from '@nao-todo/shared/locales'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useAside } from './use-aside'

defineOptions({ name: 'TasksViewAside' })

const {
    builtInProjectLinks,
    projectLinks,
    tagLinks,
    handleProjectResort,
    handleTagResort,
    collapseItemsRecord,
    dialogManager,
    isDisplayAside,
    setControllOption,
    contextMenu,
    openProjectContextMenu,
    closeProjectContextMenu,
    executeProjectContextMenu
} = useAside()

/**
 * 处理侧边栏延时传送
 * 等待侧边栏的 SubPageAsideTeleportSlot 元素渲染后再渲染 teleport
 */
const teleportDisabled = ref<boolean>(false)
watch(isDisplayAside, (nv) => nextTick(() => (teleportDisabled.value = !nv)))
onMounted(() => setControllOption({ useSlot: true, useDrawerSlot: true }))
</script>

<template>
    <teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">
        <nue-div theme="aside-wrapper">
            <nue-div vertical gap="0.25rem">
                <nue-link
                    v-for="link in builtInProjectLinks.slice(0, 5)"
                    :key="link.id"
                    :icon="link.icon"
                    :route="{ name: 'tasks-built-in-project', params: { projectId: link.id } }"
                    theme="route"
                >
                    {{ link.title }}
                    <template #append>
                        <nue-text :clamped="1">
                            {{ link.id === 'today' ? dayjs().format('M月D日') : '' }}
                        </nue-text>
                    </template>
                </nue-link>
            </nue-div>
            <nue-divider />
            <nue-collapse
                theme="menu"
                v-model="collapseItemsRecord"
                @contextmenu.prevent="openProjectContextMenu"
            >
                <project-smart-list
                    :links="projectLinks"
                    draggable
                    @open-project-creator="() => dialogManager.open(PROJECT_CREATOR_DIALOG_KEY)"
                    @open-project-manager="() => dialogManager.open(PROJECT_MANAGER_DIALOG_KEY)"
                    @resort="handleProjectResort"
                />
                <tag-smart-list
                    :links="tagLinks"
                    draggable
                    @open-tag-creator="() => dialogManager.open(TAG_CREATOR_DIALOG_KEY)"
                    @open-tag-manager="() => dialogManager.open(TAG_MANAGER_DIALOG_KEY)"
                    @resort="handleTagResort"
                />
            </nue-collapse>
            <nue-divider />
            <nue-div vertical gap="0.25rem">
                <nue-link
                    v-for="link in builtInProjectLinks.slice(5, builtInProjectLinks.length)"
                    :key="link.id"
                    :icon="link.icon"
                    :route="{ name: 'tasks-built-in-project', params: { projectId: link.id } }"
                    theme="route"
                >
                    {{ link.title }}
                </nue-link>
            </nue-div>
        </nue-div>
    </teleport>

    <!-- 入口二：清单右键菜单（项 id = archive-project，与头部 execute-id 同一 id） -->
    <teleport to="body">
        <div
            v-if="contextMenu.visible"
            class="project-context-menu-layer"
            @pointerdown="closeProjectContextMenu"
            @contextmenu.prevent="closeProjectContextMenu"
        >
            <nue-div
                class="project-context-menu"
                :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
                @pointerdown.stop
            >
                <nue-button
                    class="project-context-menu__item"
                    icon="archive"
                    theme="pure"
                    @click="executeProjectContextMenu('archive-project')"
                >
                    {{ t('component.archiveProject') }}
                </nue-button>
            </nue-div>
        </div>
    </teleport>
</template>

<style scoped>
.nue-div--block {
    flex-direction: column;
    gap: 0.5rem;
}

.nue-collapse--menu {
    gap: 0;

    .nue-collapse-item {
        border: none;
    }
}

/* 清单右键菜单：固定于光标处，随视口滚动即关闭（不跟随） */
.project-context-menu-layer {
    position: fixed;
    inset: 0;
    z-index: 3000;
}

.project-context-menu {
    position: fixed;
    flex-direction: column;
    min-width: 9rem;
    padding: var(--nue-padding-xs);
    background-color: var(--nue-primary-color-0);
    border: 1px solid var(--nue-divider-color);
    border-radius: var(--nue-primary-radius);
    box-shadow: var(--nue-secondary-shadow);

    .project-context-menu__item {
        justify-content: flex-start;
        width: 100%;
        color: var(--nue-primary-text-color);
        font-size: var(--nue-text-df);
    }
}
</style>