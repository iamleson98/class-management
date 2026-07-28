import {ActionTypes} from 'utils/constants';

export function incrementWsErrorCount() {
    return {
        type: ActionTypes.INCREMENT_WS_ERROR_COUNT,
    };
}

export function resetWsErrorCount() {
    return {
        type: ActionTypes.RESET_WS_ERROR_COUNT,
    };
}
