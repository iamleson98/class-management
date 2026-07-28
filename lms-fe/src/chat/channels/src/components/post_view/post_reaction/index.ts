import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {toggleReaction} from 'actions/post_actions';

import PostReaction from './post_reaction';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            toggleReaction,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PostReaction);
