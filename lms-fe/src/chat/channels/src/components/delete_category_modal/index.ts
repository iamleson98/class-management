import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {deleteCategory} from 'mattermost-redux/actions/channel_categories';

import DeleteCategoryModal from './delete_category_modal';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            deleteCategory,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(DeleteCategoryModal);
