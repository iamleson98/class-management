import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {revokeUserAccessToken} from 'mattermost-redux/actions/users';

import RevokeTokenButton from './revoke_token_button';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            revokeUserAccessToken,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(RevokeTokenButton);
