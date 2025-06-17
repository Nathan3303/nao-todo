<template>
    <nue-collapse v-model="activeCollapse">
        <nue-collapse-item class="smart-list" name="projects">
            <template #header="{ collapse, state }">
                <nue-div flex="1">
                    <nue-text size="var(--text-sm)">清单</nue-text>
                    <nue-text size="var(--text-sm)" color="var(--primary-color-500)">
                        {{ projectCheckboxes.length }}
                    </nue-text>
                </nue-div>
                <nue-button
                    :icon="state ? 'arrow-right' : 'arrow-down'"
                    theme="pure"
                    @click="collapse"
                />
            </template>
            <nue-checkbox-group v-model="activeProjects">
                <nue-div vertical>
                    <nue-checkbox
                        v-for="project in projectCheckboxes"
                        :key="project.id"
                        :label="project.label"
                        :name="project.name"
                    />
                </nue-div>
            </nue-checkbox-group>
        </nue-collapse-item>
        <nue-collapse-item class="smart-list" name="tags">
            <template #header="{ collapse, state }">
                <nue-div flex="1">
                    <nue-text size="var(--text-sm)">标签</nue-text>
                    <nue-text size="var(--text-sm)" color="var(--primary-color-500)">
                        {{ tagCheckboxes.length }}
                    </nue-text>
                </nue-div>
                <nue-button
                    :icon="state ? 'arrow-right' : 'arrow-down'"
                    theme="pure"
                    @click="collapse"
                />
            </template>
            <nue-checkbox-group v-model="activeTags">
                <nue-div vertical>
                    <nue-checkbox
                        v-for="tag in tagCheckboxes"
                        :key="tag.id"
                        :label="tag.label"
                        :name="tag.name"
                    />
                </nue-div>
            </nue-checkbox-group>
        </nue-collapse-item>
    </nue-collapse>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore, useTagStore } from '@/stores'
import type { Project } from '@nao-todo/types'

const projectStore = useProjectStore()
const tagStore = useTagStore()

const activeCollapse = ref(['projects', 'tags'])
const activeProjects = ref([])
const activeTags = ref([])

const projectCheckboxes = computed(() =>
    projectStore.smartListData.map((p: Project) => {
        return { id: p.id, label: p.title, name: p.id }
    })
)
const tagCheckboxes = computed(() =>
    tagStore.smartListData.map((t) => {
        return { id: t.id, label: t.name, name: t.id }
    })
)
</script>

<style scoped></style>
