package org.synthsara.nodezero.launcher

import android.content.Context

internal class LocalStore(context: Context) {
    private val preferences = context.getSharedPreferences(
        "synthsara_launcher_local_v1",
        Context.MODE_PRIVATE,
    )

    fun projects(): List<String> = preferences
        .getStringSet(KEY_PROJECTS, emptySet())
        .orEmpty()
        .sortedBy { it.lowercase() }

    fun addProject(name: String): Boolean {
        val clean = name.trim()
        if (clean.isEmpty()) return false

        val next = projects().toMutableSet()
        val added = next.add(clean)
        if (added) {
            preferences.edit().putStringSet(KEY_PROJECTS, next).apply()
        }
        return added
    }

    fun removeProject(name: String) {
        val next = projects().toMutableSet()
        if (next.remove(name)) {
            preferences.edit().putStringSet(KEY_PROJECTS, next).apply()
        }
    }

    companion object {
        private const val KEY_PROJECTS = "projects"
    }
}
