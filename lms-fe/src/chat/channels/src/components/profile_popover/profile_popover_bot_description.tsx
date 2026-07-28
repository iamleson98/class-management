import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

type Props = {
    botDescription: UserProfile['bot_description'];
};

const ProfilePopoverBotDescription = ({
    botDescription,
}: Props) => {
    return (
        <p
            className='user-profile-popover__non-heading'
            title={botDescription}
        >
            {botDescription}
        </p>
    );
};

export default ProfilePopoverBotDescription;
