import {connect} from 'react-redux';

import {getCurrentChannel, getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';

import type {GlobalState} from 'types/store/index';

import CallButton from './call_button';

function mapStateToProps(state: GlobalState) {
    return {
        currentChannel: getCurrentChannel(state),
        pluginCallComponents: state.plugins.components.CallButton,
        channelMember: getMyCurrentChannelMembership(state),
        sidebarOpen: state.views.rhs.isSidebarOpen,
    };
}

export default connect(mapStateToProps)(CallButton);
