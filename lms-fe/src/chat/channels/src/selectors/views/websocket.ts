import type {GlobalState} from 'types/store';

export const getSocketStatus = (state: GlobalState) => state.websocket;
