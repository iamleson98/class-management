/**
 * Wrapper for window.location.reload to make it mockable in tests.
 */
export function reloadPage(): void {
    window.location.reload();
}
