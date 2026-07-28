import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';

import RenderEmoticonsAsEmoji from './render_emoticons_as_emoji';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(RenderEmoticonsAsEmoji);
