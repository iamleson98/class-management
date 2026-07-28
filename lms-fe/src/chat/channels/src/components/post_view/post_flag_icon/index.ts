import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {flagPost, unflagPost} from 'actions/post_actions';

import PostFlagIcon from './post_flag_icon';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            flagPost,
            unflagPost,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PostFlagIcon);
