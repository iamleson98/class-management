import React from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

export interface Props {
    children: React.ReactNode;
    name: string;
    imageUrl: string;
}

const PostEmoji = ({children, name, imageUrl}: Props) => {
    const emojiText = `:${name}:`;
    const backgroundImageUrl = `url(${imageUrl})`;

    if (!imageUrl) {
        return <>{children}</>;
    }

    return (
        <WithTooltip
            title={emojiText}
            emoji={name}
            isEmojiLarge={true}
        >
            <span
                className='emoticon'
                data-testid={`postEmoji.${emojiText}`}
                style={{backgroundImage: backgroundImageUrl}}
                aria-label={emojiText}
            >
                {children}
            </span>
        </WithTooltip>
    );
};

export default React.memo(PostEmoji);
