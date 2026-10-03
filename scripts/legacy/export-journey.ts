// Exports the version 2 puzzle bank for the original native edition's source tree.
import {readFileSync,writeFileSync} from 'node:fs';
import {enrich} from '../../lib/legacy/journey.ts';
const bank=JSON.parse(readFileSync(new URL('../../lib/legacy/puzzles.json',import.meta.url),'utf8'));
writeFileSync(new URL('../../../ios-source/PrismPath/puzzles.json',import.meta.url),JSON.stringify({campaign:bank.campaign.map(enrich),daily:bank.daily.map(enrich)}));
