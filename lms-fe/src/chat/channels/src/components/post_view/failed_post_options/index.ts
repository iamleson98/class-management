import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {removePost} from 'mattermost-redux/actions/posts';

import {createPost} from 'actions/post_actions';

import FailedPostOptions from './failed_post_options';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createPost,
            removePost,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(FailedPostOptions);
