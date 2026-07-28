import {useEffect} from 'react';

import {POPOUT_FOCUSED, POPOUT_BLURRED} from './focus';
import {sendToParent} from './popout_windows';

export default function usePopoutFocus(channelId?: string, threadId?: string) {
    useEffect(() => {
        function handleFocus() {
            if (channelId) {
                sendToParent(POPOUT_FOCUSED, channelId, threadId);
            }
        }
        function handleBlur() {
            sendToParent(POPOUT_BLURRED);
        }
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);
        if (document.hasFocus() && channelId) {
            sendToParent(POPOUT_FOCUSED, channelId, threadId);
        }
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, [channelId, threadId]);
}
