import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';

import RenameChannelModal from './rename_channel_modal';

function mapStateToProps() {
    return {};
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RenameChannelModal);

