<template>
    <nue-footer style="padding: 4px; border: none; height: fit-content">
        <nue-div align="center" justify="space-between" wrap="nowrap">
            <nue-text size="12px" color="gray" flex> 0 of {{ total }} row(s) selected. </nue-text>
            <nue-div align="center" justify="end" width="fit-content" wrap="nowrap" gap="32px">
                <nue-div align="center" width="fit-content" gap="8px">
                    <nue-text size="12px">Rows per page</nue-text>
                    <nue-select size="small" disabled>
                        <nue-select-option label="10" value="10"></nue-select-option>
                        <nue-select-option label="20" value="20"></nue-select-option>
                        <nue-select-option label="50" value="50"></nue-select-option>
                    </nue-select>
                </nue-div>
                <nue-text size="12px">Page 1 of 10</nue-text>
                <nue-div width="fit-content" gap="8px">
                    <nue-button theme="small" icon="arrow-left-more" disabled></nue-button>
                    <nue-button theme="small" icon="arrow-left" disabled></nue-button>
                    <nue-button theme="small" icon="arrow-right" disabled></nue-button>
                    <nue-button theme="small" icon="arrow-right-more" disabled></nue-button>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-footer>
</template>

<script setup lang="ts">
defineProps<{ total: number }>()
</script>

<style scoped></style>
