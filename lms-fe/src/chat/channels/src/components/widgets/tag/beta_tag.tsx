import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import Tag from './tag';
import type {TagSize, TagVariant} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
    variant?: TagVariant;
};

const BetaTag = ({className = '', size = 'xs', variant = 'info'}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            uppercase={true}
            size={size}
            variant={variant}
            className={classNames('BetaTag', className)}
            text={formatMessage({
                id: 'tag.default.beta',
                defaultMessage: 'BETA',
            })}
        />
    );
};

export default BetaTag;
