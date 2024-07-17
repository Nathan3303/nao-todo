<template>
    <nue-div class="project-not-found" vertical>
        <img src="@/assets/not-found.webp" alt="" />
        <nue-text align="center" size="medium" color="gray">
            Unfortunately, the project you are looking for does not exist.
        </nue-text>
        <nue-text align="center" size="medium" color="gray">
            Please check the URL or try again later.
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
defineOptions({ name: 'ProjectNotFound' })
const router = useRouter()
router.push('project-dashboard')
</script>

<style scoped>
.project-not-found {
    height: 100%;
    align-items: center;
    justify-content: center;

    & img {
        aspect-ratio: 1;
        width: 256px;
    }
}
</style>
