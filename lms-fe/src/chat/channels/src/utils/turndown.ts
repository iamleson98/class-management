import {tables} from '@guyplusplus/turndown-plugin-gfm';
import TurndownService from 'turndown';

const turndownService = new TurndownService({emDelimiter: '*'}).remove('style');
turndownService.use(tables);

export default turndownService;
