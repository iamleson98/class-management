import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import PremadeThemeChooser from './premade_theme_chooser';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    const allowedThemes = (config.AllowedThemes && config.AllowedThemes.split(',')) || [];

    return {
        allowedThemes,
    };
}

export default connect(mapStateToProps)(PremadeThemeChooser);
