/**
 * Calls client-config loading (GET /api/v4/calls/config) with feature gating
 * helpers, porting the plugin webapp's config selectors. The config is mirrored
 * into the calls store so every component gates uniformly; a fetch failure
 * keeps the optimistic defaults (calls enabled) — the join path surfaces real
 * server errors anyway.
 */

'use client'

import { useEffect } from 'react'
import { useCallsStore, DEFAULT_CALLS_CONFIG, type CallsConfig } from './calls-store'

/** Fetch the calls config once per app session (react-query-free on purpose:
 * the calls store is the single source of truth). */
export async function fetchCallsConfig(): Promise<CallsConfig> {
	try {
		const res = await fetch('/api/v4/calls/config', {
			credentials: 'include',
			headers: { 'X-Requested-With': 'XMLHttpRequest' },
		})
		if (!res.ok) return useCallsStore.getState().config
		const data = (await res.json()) as Partial<CallsConfig>
		const merged: CallsConfig = { ...DEFAULT_CALLS_CONFIG, ...data }
		useCallsStore.getState().setConfig(merged)
		return merged
	} catch {
		return useCallsStore.getState().config
	}
}

/**
 * useCallsConfig — mounts the one-shot config fetch and returns the live
 * config. Safe to mount from several components; only the first runs the fetch.
 */
let configFetched = false

export function useCallsConfig(): CallsConfig {
	const config = useCallsStore((s) => s.config)
	useEffect(() => {
		if (configFetched) return
		configFetched = true
		void fetchCallsConfig()
	}, [])
	return config
}
