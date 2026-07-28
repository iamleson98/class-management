import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {emitBrowserWindowResized} from 'actions/views/browser';

import MobileViewWatcher from './mobile_view_watcher';

const mapDispatchToProps = {
    emitBrowserWindowResized,
};

const connector = connect(null, mapDispatchToProps);
export type PropsFromRedux = ConnectedProps<typeof connector>;
export default connector(MobileViewWatcher);
