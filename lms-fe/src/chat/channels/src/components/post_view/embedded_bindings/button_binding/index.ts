import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getChannel} from 'mattermost-redux/actions/channels';

import {postEphemeralCallResponseForPost, handleBindingClick, openAppsModal} from 'actions/apps';

import ButtonBinding from './button_binding';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            handleBindingClick,
            getChannel,
            postEphemeralCallResponseForPost,
            openAppsModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(ButtonBinding);
