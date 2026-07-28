export function getPluginPreferenceKey(pluginId: string) {
    return `pp_${pluginId}`.slice(0, 32);
}
