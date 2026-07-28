import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {addOAuthApp} from 'mattermost-redux/actions/integrations';

import AddOAuthApp from './add_oauth_app';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addOAuthApp,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(AddOAuthApp);
