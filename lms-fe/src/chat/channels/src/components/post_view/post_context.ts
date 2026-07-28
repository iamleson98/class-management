import React from 'react';

interface PostContextValue {
    handlePopupOpened: ((opened: boolean) => void) | null;
}
const PostContext = React.createContext<PostContextValue>({

    // Post component event handler that should be
    // called when any child component opens/closes a
    // popup type component.
    handlePopupOpened: null,
});

export default PostContext;
