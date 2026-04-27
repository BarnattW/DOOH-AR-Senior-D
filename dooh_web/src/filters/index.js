import * as cyber   from './cyber';
import * as thermal from './thermal';
import * as neon    from './neon';
import * as glitch  from './glitch';
import * as kaboom  from './kaboom';
import * as kingKong from './kingKong';
import * as sol from './statueOfLiberty';
import * as unique from './unique';

export const FILTERS = [unique, cyber, thermal, neon, glitch, kaboom, sol];
export const DEFAULT_FILTER_ID = 'unique';
