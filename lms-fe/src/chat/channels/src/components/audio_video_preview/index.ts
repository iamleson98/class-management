import {connect} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import AudioVideoPreview from './audio_video_preview';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
    };
}

export default connect(mapStateToProps)(AudioVideoPreview);
