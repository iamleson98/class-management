import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import Tag from './tag';
import type {TagSize} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
};

const BotTag = ({className = '', size = 'xs'}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            uppercase={true}
            size={size}
            className={classNames('BotTag', className)}
            text={formatMessage({
                id: 'tag.default.bot',
                defaultMessage: 'BOT',
            })}
        />
    );
};

export default BotTag;
