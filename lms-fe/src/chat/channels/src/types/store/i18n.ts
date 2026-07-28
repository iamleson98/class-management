export type I18nState = {
    translations: {
        [locale: string]: Translations;
    };
};

export type Translations = {
    [key: string]: string;
};
