import classNames from 'classnames';
import React, {memo} from 'react';
import type {ComponentProps} from 'react';
import {useIntl} from 'react-intl';

import Button from '../button';

type Props = {
    isFollowing: boolean | null | undefined;
};

function FollowButton({
    isFollowing,
    ...props
}: Props & Exclude<ComponentProps<typeof Button>, Props>) {
    const {formatMessage} = useIntl();
    return (
        <Button
            {...props}
            className={classNames(props.className, 'FollowButton')}
            disabled={Boolean(props.disabled)}
            isActive={isFollowing ?? false}
        >
            {isFollowing ? formatMessage({
                id: 'threading.following',
                defaultMessage: 'Following',
            }) : formatMessage({
                id: 'threading.notFollowing',
                defaultMessage: 'Follow',
            })}
        </Button>
    );
}

export default memo(FollowButton);
