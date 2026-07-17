<script setup lang="ts">
import ProjectCreator from './project-creator'
import ProjectManager from './project-manager'
import ProjectUpdater from './project-updater'
import TagCreator from './tag-creator'
import TagColorUpdater from './tag-color-updater'
import TagManager from './tag-manager'
import TagUpdater from './tag-updater'

defineOptions({ name: 'AppDialogsAdapter' })
</script>

<template>
    <project-creator />
    <project-manager />
    <ProjectUpdater />
    <TagCreator />
    <TagColorUpdater />
    <TagManager />
    <TagUpdater />
</template>
