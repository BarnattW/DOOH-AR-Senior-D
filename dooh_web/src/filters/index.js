import * as cyber   from './cyber';
import * as thermal from './thermal';
import * as neon    from './neon';
import * as glitch  from './glitch';
import * as kaboom  from './kaboom';
import * as kingKong from './kingKong';

export const FILTERS = [cyber, thermal, neon, glitch, kaboom, kingKong];
export const DEFAULT_FILTER_ID = 'cyber';
