import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import ExternalImage from './external_image';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        enableSVGs: config.EnableSVGs === 'true',
        hasImageProxy: config.HasImageProxy === 'true',
    };
}

export default connect(mapStateToProps)(ExternalImage);
