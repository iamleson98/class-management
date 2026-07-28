import {useLayoutEffect, useRef} from 'react';

/**
 * Returns a ref that always holds the latest value.
 * Useful for accessing current values in callbacks without
 * adding them to dependency arrays.
 *
 * The ref is updated in useLayoutEffect (not during render)
 * to avoid stale values from abandoned renders in Concurrent Mode.
 */
export function useLatest<T>(value: T) {
    const ref = useRef(value);
    useLayoutEffect(() => {
        ref.current = value;
    });
    return ref;
}
