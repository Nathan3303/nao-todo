import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLoadingErrorStoreBase, useTagPreferenceStoreBase, useTagsStoreBase } from '../base'

export default defineStore('TagsStore', () => {
    // @storebase Tag store base
    const { tags, setTags, addTag, getTag, updateTag } = useTagsStoreBase()

    // @storebase 内建标签存储加载/错误基础
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // @storebase 标签偏好存储基础
    const {
        tagPreference,
        setTagPreference,
        getTagPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    } = useTagPreferenceStoreBase()

    // @storebase 标签偏好存储加载/错误基础
    const {
        loading: preferenceLoading,
        error: preferenceError,
        setLoading: setPreferenceLoading,
        setError: setPreferenceError
    } = useLoadingErrorStoreBase()

    // @returns
    return {
        tags: computed(() => tags.value),
        setTags,
        addTag,
        getTag,
        updateTag,
        loading: computed(() => loading.value),
        error: computed(() => error.value),
        setLoading,
        setError,
        tagPreference: computed(() => tagPreference.value),
        setTagPreference,
        getTagPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions,
        preferenceLoading: computed(() => preferenceLoading.value),
        preferenceError: computed(() => preferenceError.value),
        setPreferenceLoading,
        setPreferenceError
    }
})
