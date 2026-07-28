import React from 'react';

type Props = {
    hasFullName: boolean;
    username: string;
};

const ProfilePopoverUserName = ({
    hasFullName,
    username,
}: Props) => {
    return (
        <p
            id='userPopoverUsername'
            className={
                hasFullName ? 'user-profile-popover__non-heading' : 'user-profile-popover__heading'
            }
            title={username}
        >
            {`@${username}`}
        </p>
    );
};

export default ProfilePopoverUserName;
