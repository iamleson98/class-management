import {connect} from 'react-redux';
import {bindActionCreators, type Dispatch} from 'redux';

import {addMessageIntoHistory} from 'mattermost-redux/actions/posts';

import SuggestionBox from './suggestion_box';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addMessageIntoHistory,
        }, dispatch),
    };
}
export default connect(null, mapDispatchToProps, null, {forwardRef: true})(SuggestionBox);
