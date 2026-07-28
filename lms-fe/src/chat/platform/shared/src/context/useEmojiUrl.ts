import React from 'react';

import type {Emoji} from '@mattermost/types/emojis';

import {SharedContext} from './context';

export function useEmojiUrl(emoji?: Emoji) {
    const context = React.useContext(SharedContext);

    return context.useEmojiUrl(emoji);
}
