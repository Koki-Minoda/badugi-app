"""Read-only Badugi JS/Python observation comparison; mismatch exits nonzero."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv

parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
cases=[]
for phase in ['BET','DRAW']:
    env=SixMaxBadugiEnv();env.reset(seed=186);env.phase=phase
    seat=env.hero_seat
    names=['FOLD','CHECK','CALL','BET','RAISE','ALL_IN'] if phase=='BET' else ['draw_0','draw_1','draw_2','draw_3','unused_4','unused_5']
    legal=[name for name,allowed in zip(names,env._mask_for(seat)) if allowed]
    state={'phase':phase,'street':phase,'drawRoundIndex':env.draw_round,'maxDrawRounds':3,
        'currentBet':env.current_bet,'raiseCount':env.raise_count,'dealerIndex':env.dealer_seat,
        'actingPlayerIndex':seat,'turn':seat,'pot':env.pot,
        'players':[{'seatIndex':index,'hand':p['hand'],'stack':p['stack'],'betThisRound':p['bet'],
            'folded':p['folded'],'allIn':p['all_in'],'lastDrawCount':p['last_draw']}
            for index,p in enumerate(env.players)]}
    cases.append({'phase':phase,'payload':{'state':state,'seatIndex':seat,'legalActions':legal},'python':env._obs_for(seat).tolist()})
script='''
import {buildBadugiObservationVector} from './src/rl/badugiObservationSchema.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
process.stdout.write(JSON.stringify(JSON.parse(input).map(row=>buildBadugiObservationVector(row.payload))));
'''
result=subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(cases),cwd=ROOT,capture_output=True,text=True,check=True)
rows=[]
for case,browser in zip(cases,json.loads(result.stdout)):
    python=case['python']
    differences=[{'slot':index,'browser':js,'python':py} for index,(js,py) in enumerate(zip(browser,python)) if abs(js-py)>1e-6]
    rows.append({'variantId':'D03','phase':case['phase'],'browserLength':len(browser),'pythonLength':len(python),'mismatchCount':len(differences),'differences':differences})
passed=all(row['browserLength']==row['pythonLength']==96 and not row['differences'] for row in rows)
report={'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'status':'PASS' if passed else 'MISMATCH',
    'scope':'Seed186 reset with explicit phase. Same-state encoding diagnostic, not a natural played hand or strength evaluation.',
    'browserSource':'src/rl/badugiObservationSchema.js','pythonSource':'src/rl/env/badugi_env_sixmax_selfplay.py','cases':rows}
output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':report['status'],'cases':[{'phase':r['phase'],'mismatchCount':r['mismatchCount']} for r in rows]}))
raise SystemExit(0 if passed else 1)
