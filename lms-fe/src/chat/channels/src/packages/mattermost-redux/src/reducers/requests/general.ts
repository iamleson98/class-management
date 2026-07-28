import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {GeneralTypes} from 'mattermost-redux/action_types';

import {handleRequest, initialRequestState} from './helpers';

function websocket(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    if (action.type === GeneralTypes.WEBSOCKET_CLOSED) {
        return initialRequestState();
    }

    return handleRequest(
        GeneralTypes.WEBSOCKET_REQUEST,
        GeneralTypes.WEBSOCKET_SUCCESS,
        GeneralTypes.WEBSOCKET_FAILURE,
        state,
        action,
    );
}

export default combineReducers({
    websocket,
});
