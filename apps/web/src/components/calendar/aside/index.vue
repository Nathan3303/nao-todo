<script setup lang="ts">
import {
    NaoSmartList,
    PROJECT_CREATOR_DIALOG_KEY,
    PROJECT_MANAGER_DIALOG_KEY,
    TAG_CREATOR_DIALOG_KEY,
    TAG_MANAGER_DIALOG_KEY
} from '@nao-todo/shared'
import { ref } from 'vue'
import useCalendarSmartList from './use-calendar-smart-list'

defineOptions({ name: 'CalendarAside' })

const collapseItemsRecord = ref(['projects', 'tags'])

const { projectOptions, tagOptions, selectedProjectIds, selectedTagIds, dialogManager } =
    useCalendarSmartList()
</script>

<template>
    <nue-div theme="calendar-aside">
        <nue-div theme="controller-wrapper"></nue-div>
        <nue-divider />
        <nue-div theme="smart-list-wrapper">
            <nue-collapse v-model="collapseItemsRecord" theme="menu">
                <nao-smart-list
                    collapse-item-name="projects"
                    name="清单"
                    :count="projectOptions.length"
                    manage-btn-tooltip="管理清单"
                    create-btn-tooltip="新建清单"
                    @manage="dialogManager.open(PROJECT_MANAGER_DIALOG_KEY)"
                    @create="dialogManager.open(PROJECT_CREATOR_DIALOG_KEY)"
                >
                    <template #actions></template>
                    <nue-checkbox-group v-model="selectedProjectIds">
                        <nue-checkbox
                            v-for="p in projectOptions"
                            :key="p.id"
                            :name="p.id"
                            :label="p.name"
                        />
                    </nue-checkbox-group>
                </nao-smart-list>
                <nao-smart-list
                    collapse-item-name="tags"
                    name="标签"
                    :count="tagOptions.length"
                    manage-btn-tooltip="管理标签"
                    create-btn-tooltip="新建标签"
                    @manage="dialogManager.open(TAG_MANAGER_DIALOG_KEY)"
                    @create="dialogManager.open(TAG_CREATOR_DIALOG_KEY)"
                >
                    <template #actions></template>
                    <nue-checkbox-group v-model="selectedTagIds">
                        <nue-checkbox
                            v-for="t in tagOptions"
                            :key="t.id"
                            :name="t.id"
                            :label="t.name"
                        />
                    </nue-checkbox-group>
                </nao-smart-list>
            </nue-collapse>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--calendar-aside {
    flex-direction: column;
    flex: auto;
    height: 100%;
    padding: 1rem;
    overflow: auto;

    > .nue-div--smart-list-wrapper {
        width: 100%;
        flex-direction: column;

        .nue-collapse--menu {
            gap: 0;

            .nue-collapse-item {
                border: none;
            }

            .nue-checkbox {
                padding: 0;
            }
        }
    }
}
</style>
