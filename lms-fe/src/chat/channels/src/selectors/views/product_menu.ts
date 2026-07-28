import type {GlobalState} from 'types/store';

export function isSwitcherOpen(state: GlobalState): boolean {
    return state.views.productMenu.switcherOpen;
}
