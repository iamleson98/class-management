package plugin

type metricsInterface interface {
	ObservePluginHookDuration(pluginID, hookName string, success bool, elapsed float64)
	ObservePluginMultiHookIterationDuration(pluginID string, elapsed float64)
	ObservePluginMultiHookDuration(elapsed float64)
	ObservePluginAPIDuration(pluginID, apiName string, success bool, elapsed float64)
}
