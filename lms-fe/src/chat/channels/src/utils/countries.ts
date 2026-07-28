import {getData, overwrite} from 'country-list';

type Country = {
    name: string;
    code: string;
};

overwrite([{
    code: 'TW',
    name: 'Taiwan',
}]);

export const COUNTRIES = getData().sort((a: Country, b: Country) => (a.name > b.name ? 1 : -1));
