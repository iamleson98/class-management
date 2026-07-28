import {useContext, useEffect} from 'react';

import type {WebSocketClient, WebSocketMessage} from '@mattermost/client';

import {WebSocketContext} from './context';

export type UseWebSocketOptions = {
    handler: (msg: WebSocketMessage) => void;
};

export function useWebSocket({handler}: UseWebSocketOptions) {
    const wsClient = useWebSocketClient();

    useEffect(() => {
        wsClient.addMessageListener(handler);

        return () => {
            wsClient.removeMessageListener(handler);
        };
    }, [wsClient, handler]);
}

export function useWebSocketClient(): WebSocketClient {
    return useContext(WebSocketContext);
}
