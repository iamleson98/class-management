import {connect} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import ListItem from './list_item';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
    };
}

export default connect(mapStateToProps, null, null, {forwardRef: true})(ListItem);
