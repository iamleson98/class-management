import React, {useEffect} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {fetchChannelRemotes} from 'mattermost-redux/actions/shared_channels';
import {getRemoteNamesForChannel} from 'mattermost-redux/selectors/entities/shared_channels';

import SharedChannelIndicator from 'components/shared_channel_indicator';

import type {GlobalState} from 'types/store';

type Props = {
    channelId: string;
    className?: string;
};

const AdminChannelSharedIndicator: React.FC<Props> = ({channelId, className}) => {
    const dispatch = useDispatch();
    const remoteNames = useSelector(
        (state: GlobalState) => getRemoteNamesForChannel(state, channelId),
        shallowEqual,
    );

    useEffect(() => {
        if (channelId && remoteNames.length === 0) {
            dispatch(fetchChannelRemotes(channelId));
        }
    }, [channelId, remoteNames.length, dispatch]);

    return (
        <SharedChannelIndicator
            className={className}
            withTooltip={true}
            remoteNames={remoteNames}
        />
    );
};

export default AdminChannelSharedIndicator;
