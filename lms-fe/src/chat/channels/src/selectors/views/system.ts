import type {GlobalState} from 'types/store';

export function connectionErrorCount(state: GlobalState) {
    return state.views.system.websocketConnectionErrorCount;
}
