import React from 'react';

import {SharedContext} from './context';

export function useEmojiByName(name: string) {
    const context = React.useContext(SharedContext);

    return context.useEmojiByName(name);
}
