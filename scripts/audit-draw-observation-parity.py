"""Read-only cross-language Draw observation audit. A mismatch exits nonzero."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from rl.env.draw_lowball_env_sixmax_selfplay import SixMaxDrawLowballEnv
from rl.env.draw_lowball_env import DRAW_ACTIONS

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
cases = []
labels = {11:'J',12:'Q',13:'K',14:'A'}
for variant, family, draws in [('D01','low-27',3),('D02','low-a5',3),('S01','low-27',1),('S02','low-a5',1)]:
    for phase in ['BET','DRAW']:
        env = SixMaxDrawLowballEnv(family=family,max_draws=draws,seed=184)
        env.reset(seed=184)
        env.phase = phase
        seat = env.hero_seat
        mask = env._mask_for(seat)
        legal = [action for action,allowed in zip(DRAW_ACTIONS,mask) if allowed]
        state = {
            'street':phase,'drawRoundIndex':env.draw_round,'dealerIndex':env.dealer_seat,
            'actingPlayerIndex':seat,'pot':env.pot,
            'metadata':{'currentBet':env.current_bet,'raiseCountThisRound':env.raise_count},
            'players':[{'stack':p['stack'],'bet':p['bet'],'folded':p['folded'],
                'hand':[str(labels.get(rank,rank))+'CDHS'[suit] for rank,suit in p['hand']]}
                for p in env.players],
        }
        cases.append({'variantId':variant,'phase':phase,'fixture':'seed184 reset with explicit phase; not a played-hand acceptance test',
            'payload':{'state':state,'seatIndex':seat,'variantId':variant,'legalActions':legal},
            'python':env._obs_for(seat).tolist()})
script = '''
import {buildDrawObservationVector} from './src/rl/drawObservationSchema.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
process.stdout.write(JSON.stringify(JSON.parse(input).map(row=>buildDrawObservationVector(row.payload))));
'''
result = subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(cases),cwd=ROOT,capture_output=True,text=True,check=True)
rows=[]
for case, browser in zip(cases,json.loads(result.stdout)):
    python=case['python']
    differences=[{'slot':index,'browser':js,'python':py} for index,(js,py) in enumerate(zip(browser,python)) if abs(js-py)>1e-6]
    rows.append({'variantId':case['variantId'],'phase':case['phase'],'fixture':case['fixture'],
        'browserLength':len(browser),'pythonLength':len(python),'mismatchCount':len(differences),'differences':differences})
passed=all(row['browserLength']==row['pythonLength']==96 and not row['differences'] for row in rows)
report={'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
    'status':'PASS' if passed else 'MISMATCH','scope':'Same-state observation semantics only; no training or model promotion.',
    'browserSource':'src/rl/drawObservationSchema.js','pythonSource':'src/rl/env/draw_lowball_env_sixmax_selfplay.py',
    'cases':rows}
output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':report['status'],'cases':[{'variantId':r['variantId'],'phase':r['phase'],'mismatchCount':r['mismatchCount']} for r in rows]}))
raise SystemExit(0 if passed else 1)
