import {EMOJI_PATTERN} from 'utils/emoticons';

import PlainRenderer from './plain_renderer';

/** A Markdown renderer that converts a post into plain text that we can search for mentions */
export default class MentionableRenderer extends PlainRenderer {
    public text(text: string) {
        // Remove all emojis
        return text.replace(EMOJI_PATTERN, '');
    }
}
