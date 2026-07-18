<script setup lang="ts">
import { t } from '@nao-todo/shared'
import { NueInput } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useUserStore } from '../../stores'
import { UserNicknameUpdaterProps } from './types'

defineOptions({ name: 'SettingsProfileNickname' })
const props = defineProps<UserNicknameUpdaterProps>()

const userStore = useUserStore()

const { profile } = storeToRefs(userStore)
const inputValue = ref(profile.value?.nickname || '')
const loading = ref<boolean>(false)

const isNicknameChanged = computed(() => inputValue.value !== profile.value?.nickname)

const handleUpdateNickname = async () => {
    loading.value = true
    await props.userUseCase.updateNickname({ nickname: inputValue.value })
    loading.value = false
}
</script>

<template>
    <nue-div theme="nickname-updater">
        <nue-input
            v-model="inputValue"
            :placeholder="t('settings.nicknamePlaceholder')"
            maxlength="16"
        />
        <nue-button
            theme="primary"
            :disabled="!isNicknameChanged"
            :loading="loading"
            @click="handleUpdateNickname"
        >
            {{ t('settings.nicknameSubmit') }}
        </nue-button>
    </nue-div>
</template>

<style scoped>
.nue-div--nickname-updater {
    align-items: center;
}
</style>
