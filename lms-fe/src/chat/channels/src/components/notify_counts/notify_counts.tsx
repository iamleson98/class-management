import React from 'react';

import type {BasicUnreadMeta} from 'mattermost-redux/selectors/entities/channels';

const NotifyCounts = ({unreadMentionCount, isUnread}: BasicUnreadMeta) => {
    if (unreadMentionCount) {
        return <span className='badge badge-notify'>{unreadMentionCount}</span>;
    } else if (isUnread) {
        return <span className='badge badge-notify'>{'•'}</span>;
    }
    return null;
};

export default React.memo(NotifyCounts);
