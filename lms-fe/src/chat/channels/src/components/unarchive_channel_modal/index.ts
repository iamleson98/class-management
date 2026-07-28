import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {unarchiveChannel} from 'mattermost-redux/actions/channels';

import UnarchiveChannelModal from './unarchive_channel_modal';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            unarchiveChannel,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(UnarchiveChannelModal);
