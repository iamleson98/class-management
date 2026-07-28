/**
 * See https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming
 */
export interface PerformanceLongTaskTiming extends PerformanceEntry {
    readonly entryType: 'longtask';
}
