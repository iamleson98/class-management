import {combineReducers} from 'redux';

import admin from './admin';
import channels from './channels';
import files from './files';
import general from './general';
import posts from './posts';
import roles from './roles';
import search from './search';
import teams from './teams';
import users from './users';

export default combineReducers({
    channels,
    files,
    general,
    posts,
    teams,
    users,
    admin,
    search,
    roles,
});
