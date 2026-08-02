

import {applyMiddleware, combineReducers, createStore} from 'redux';
import thunk from 'redux-thunk';

export const mockStore = (initialState = {}) => {
    const reducer = combineReducers({
        'plugins-com.mattermost.calls': (state = {}) => state,
        entities: (state = {}) => state,
    });

    return createStore(
        reducer,
        initialState,
        applyMiddleware(thunk),
    );
};
