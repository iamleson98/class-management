import type {GlobalState} from 'types/store';

export function getShouldFocusRHS(state: GlobalState): boolean {
    return state.views.rhs.shouldFocusRHS;
}
