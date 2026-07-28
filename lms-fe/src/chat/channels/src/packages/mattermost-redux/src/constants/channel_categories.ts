import type {ChannelCategoryType} from '@mattermost/types/channel_categories';

export const CategoryTypes: {[name: string]: ChannelCategoryType} = {
    FAVORITES: 'favorites',
    CHANNELS: 'channels',
    DIRECT_MESSAGES: 'direct_messages',
    CUSTOM: 'custom',
    MANAGED: 'managed',
};

export const ManagedCategoryPropertyGroupName = 'managed_channel_categories';
export const ManagedCategoryPropertyFieldName = 'category_name';
