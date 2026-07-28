import React from 'react';

import type {WebSocketClient} from '@mattermost/client';

export const WebSocketContext = React.createContext<WebSocketClient>(null!);
