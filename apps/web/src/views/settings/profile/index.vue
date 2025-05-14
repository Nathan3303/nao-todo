<template>
    <nue-container theme="vertical,inner">
        <nue-header>
            <nue-text>设置 - 用户信息</nue-text>
        </nue-header>
        <nue-main>
            <nue-div vertical gap="2rem">
                <profile-avatar />
                <profile-nickname />
                <profile-info />
            </nue-div>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import ProfileAvatar from './profile-avatar.vue'
import ProfileNickname from './profile-nickname.vue'
import ProfileInfo from './profile-info.vue'

defineOptions({ name: 'SettingsProfile' })
</script>
