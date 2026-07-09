import { defineStore } from 'pinia'
import { useLoadingErrorStoreBase, useTagPreferenceStoreBase, useTagsStoreBase } from './base'

export default defineStore('TagsStore', () => {
    const { tags, setTags, addTag, getTag, updateTag, updateTags, getAllTags, deleteTag } =
        useTagsStoreBase()
    const {
        tagPreference,
        setTagPreference,
        getTagPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    } = useTagPreferenceStoreBase()

    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    const {
        loading: preferenceLoading,
        error: preferenceError,
        setLoading: setPreferenceLoading,
        setError: setPreferenceError
    } = useLoadingErrorStoreBase()

    // @returns
    return {
        // --- Tag ---
        tags,
        setTags,
        addTag,
        getTag,
        updateTag,
        updateTags,
        getAllTags,
        deleteTag,
        // --- Tag Preference ---
        tagPreference,
        setTagPreference,
        getTagPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions,
        // --- Tag Loading Error ---
        loading,
        error,
        setLoading,
        setError,
        // --- Tag Preference Loading Error ---
        preferenceLoading,
        preferenceError,
        setPreferenceLoading,
        setPreferenceError
    }
})

