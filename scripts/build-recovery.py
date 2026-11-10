#!/usr/bin/env python3
"""Deterministic, offline, past-only rolling OLS validation and conditional gap reconstruction.
Install requirements-recovery.txt; run from any directory. Never modifies market.json.
"""
from pathlib import Path
import argparse, hashlib, json, math
import numpy as np
import statsmodels.api as sm
from statsmodels.stats.stattools import durbin_watson, jarque_bera

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT / path).read_text())
def sha(path): return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
market = read('public/data/market.json')
inputs = read('public/data/recovery-inputs.json')
assert inputs['marketFileSha256'] == sha('public/data/market.json'), 'Market input changed; fetch/audit again'
quote = {q['date']: q for q in market['quotes']}
index = inputs['index']['observations']
assert len(index) > 1000 and len({q['date'] for q in index}) == len(index)
index = sorted(index, key=lambda q: q['date'])
REGIMES = [
    ('2020-12-01','2022-02-23','До кризиса 2022'),
    ('2022-03-29','2024-02-15','После открытия 2022, до редомициляции'),
    ('2024-03-18','2024-08-31','После редомициляции, до нового периметра'),
    ('2024-09-01','2025-12-31','Новый периметр группы, 2024–2025'),
]
def regime(date): return next((name for a,b,name in REGIMES if a <= date <= b), None)
def days(a,b):
    from datetime import date
    return (date.fromisoformat(b) - date.fromisoformat(a)).days
points = [{'date':q['date'], 'M':q['close'], 'T':quote.get(q['date'],{}).get('T'),
           'S':quote.get(q['date'],{}).get('SBER')} for q in index]
features = {}
training = []
for i in range(1,len(points)):
    a,b=points[i-1],points[i]
    if not a['S'] or not b['S']: continue
    x=[math.log(b['M']/a['M']),math.log(b['S']/a['S'])]
    features[i]=x
    if a['T'] and b['T'] and regime(a['date']) is not None and regime(a['date']) == regime(b['date']) and days(a['date'],b['date']) <= 7:
        training.append({'i':i,'date':b['date'],'regime':regime(b['date']),'x':x,'y':math.log(b['T']/a['T'])})

def fit(rows,method,diagnostics=False):
    columns=1 if method=='market' else 2
    X=np.array([[1.,*r['x'][:columns]] for r in rows]); y=np.array([r['y'] for r in rows])
    if len(rows)<60 or np.linalg.matrix_rank(X)<columns+1: return None
    ols=sm.OLS(y,X).fit()
    vif=1. if columns==1 else float(1./(1.-np.corrcoef(X[:,1],X[:,2])[0,1]**2))
    result={'method':method,'n':len(rows),'from':rows[0]['date'],'till':rows[-1]['date'],
            'coefficients':[float(v) for v in ols.params], 'r2':float(ols.rsquared), 'vif':vif}
    if diagnostics:
        residual=ols.resid
        jb=jarque_bera(residual)
        result['residuals']={'mean':float(np.mean(residual)), 'std':float(np.std(residual,ddof=columns+1)),
          'lag1':float(np.corrcoef(residual[:-1],residual[1:])[0,1]),'durbinWatson':float(durbin_watson(residual)),
          'skewness':float(jb[2]),'kurtosis':float(jb[3]),'jarqueBeraP':float(jb[1])}
        result['coefficientIntervalsHAC95']=ols.get_robustcov_results(cov_type='HAC',maxlags=5).conf_int().tolist()
        half=len(rows)//2
        result['stability']=[fit(rows[:half],method),fit(rows[half:],method)]
    return result

def predict(model,start,end,bridge):
    a,b=points[start-1],points[end]
    raw=np.array([sum(c*v for c,v in zip(model['coefficients'],[1.,*features[i]])) for i in range(start,end+1)])
    if bridge:
        raw += (math.log(b['T']/a['T']) - float(sum(raw))) / len(raw)
    path=a['T']*np.exp(np.cumsum(raw))
    return [float(x) for x in path[:-1]]

def interpolation(start,end):
    left,right=points[start-1]['T'],points[end]['T']; N=end-start+1
    return [float(left*math.exp(math.log(right/left)*k/N)) for k in range(1,N)]

def errors(actual,estimated):
    delta=np.array(estimated)-np.array(actual)
    return {'mae':float(np.mean(np.abs(delta))), 'rmse':float(np.sqrt(np.mean(delta**2))),
            'relativeRmse':float(np.sqrt(np.mean((delta/np.array(actual))**2)))}

folds=[]
for begin,end,name in REGIMES:
    indices=[i for i,p in enumerate(points) if begin <= p['date'] <= end]
    for offset in [90,130,180,230,280,340,400]:
        for length in [3,10,20]:
            if offset+length >= len(indices): continue
            start,stop=indices[offset],indices[offset+length]
            if stop-start != length or not all(points[i]['T'] for i in range(start-1,stop+1)) or not all(i in features for i in range(start,stop+1)): continue
            if any(days(points[i-1]['date'],points[i]['date'])>7 for i in range(start,stop+1)): continue
            rows=[r for r in training if r['i']<start and r['regime']==name][-252:]
            if len(rows)<80: continue
            actual=[points[i]['T'] for i in range(start,stop)]
            base={'regime':name,'from':points[start]['date'],'till':points[stop-1]['date'],
                  'leftAnchor':points[start-1]['date'],'rightAnchor':points[stop]['date'],
                  'length':length,'phase':'test' if points[start]['date']>='2025-01-01' else 'validation'}
            folds.append({**base,'method':'interpolation','mode':'bridge','eligible':True,**errors(actual,interpolation(start,stop))})
            for method in ['market','market-sector']:
                model=fit(rows,method)
                if not model: continue
                for bridge in [True,False]:
                    folds.append({**base,'method':method,'mode':'bridge' if bridge else 'conditional-forward',
                        'eligible':model['vif']<=5,'trainFrom':model['from'],'trainTill':model['till'],
                        'n':model['n'],'coefficients':model['coefficients'],'r2':model['r2'],'vif':model['vif'],
                        **errors(actual,predict(model,start,stop,bridge))})

def aggregate(phase,method,mode='bridge',length=None):
    rows=[r for r in folds if r['phase']==phase and r['method']==method and r['mode']==mode and (length is None or r['length']==length)]
    if not rows: return None
    return {'phase':phase,'method':method,'mode':mode,'length':length,'folds':len(rows),
            'eligible':all(r['eligible'] for r in rows),**{key:float(np.mean([r[key] for r in rows])) for key in ['mae','rmse','relativeRmse']}}
aggregates=[v for phase in ['validation','test'] for method in ['interpolation','market','market-sector']
    for mode in (['bridge'] if method=='interpolation' else ['bridge','conditional-forward'])
    for length in [None,3,10,20] if (v:=aggregate(phase,method,mode,length))]
validation=[aggregate('validation',m) for m in ['interpolation','market','market-sector']]
assert all(validation)
assert len({r['folds'] for r in validation})==1, 'Unequal validation folds'
market_candidates=[r for r in validation if r['method']!='interpolation' and r['eligible']]
factor_method=min(market_candidates,key=lambda r:r['relativeRmse'])['method']
best=min([r for r in validation if r['eligible']],key=lambda r:r['relativeRmse'])['method']
left=next(i for i,p in enumerate(points) if p['date']=='2024-02-15')
right=next(i for i,p in enumerate(points) if p['date']=='2024-03-18')
rows=[r for r in training if r['i']<=left and r['regime']==regime('2024-02-15')][-252:]
models=[fit(rows,method,True) for method in ['market','market-sector']]
assert all(models)
model=next(r for r in models if r['method']==factor_method)
regressed=predict(model,left+1,right,True)
interpolated=interpolation(left+1,right)
estimates={points[i]['date']:{'regressionPrice':regressed[i-left-1], 'interpolatedPrice':interpolated[i-left-1]} for i in range(left+1,right)}
assert len(estimates)==19
expected_missing=set(estimates)|{'2022-03-24','2022-03-25','2022-03-28','2025-10-04','2025-10-05'}
assert {q['date'] for q in market['quotes'] if q['T'] is None}==expected_missing, 'New gaps outside the audited calendar: extend the source audit before rebuilding'
sources=[
 {'id':'halt-2022','title':'Открытие торгов 33 акциями, 24.03.2022','url':'https://www.moex.com/n45532'},
 {'id':'cbr-2022','title':'Банк России: режим торгов 28.03.2022','url':'https://www.cbr.ru/press/pr/?file=26032022_125655SUP_MEAS26032022_130111.htm'},
 {'id':'redom','title':'Ограничения TCSG в феврале 2024','url':'https://www.moex.com/n67373'},
 {'id':'conversion','title':'Конвертация ГДР TCSG в акции','url':'https://www.moex.com/n67851'},
 {'id':'reopen','title':'Возобновление 18.03.2024','url':'https://www.moex.com/n68303'},
 {'id':'weekend','title':'Запрет сделок с T 04–05.10.2025','url':'https://www.moex.com/n94157'},
 {'id':'ticker','title':'TCSG → T с 28.11.2024','url':'https://www.moex.com/n74886'},
 {'id':'split','title':'Сплит 1:10, начало торгов 17.04.2026','url':'https://www.moex.com/n99355'},
 {'id':'iss','title':'MOEX ISS: фактические дневные свечи TQBR T','url':next(s['url'] for s in market['sources'] if s['id']=='moex-T')},
 {'id':'iss-reference','title':'Документация MOEX ISS','url':'https://iss.moex.com/iss/reference/'},
 {'id':'imoex','title':'IMOEX: дневные свечи индекса цен','url':inputs['sources'][0]['url']},
]
observations=[]
for q in market['quotes']:
    d=q['date']; actual=q['T']
    rec={'date':d,'actualPrice':actual,'estimatedPrice':None,'regressionPrice':None,'interpolatedPrice':None,
         'status':'actual' if actual is not None else 'no-trading','method':'none','category':'actual',
         'tradable':actual is not None,'reason':'Фактическая свеча TQBR; база сплита 1:10 уже учтена.',
         'sourceIds':['iss'],'lower':None,'upper':None}
    if actual is None:
        if d.startswith('2022'):
            rec.update(category='suspension',reason='На TQBR иностранная ГДР ещё не допущена после общерыночной остановки. Сквозная интерполяция через кризисный разрыв не применяется.',sourceIds=['halt-2022','cbr-2022'])
        elif d.startswith('2024'):
            reason=('Нет TQBR/Т+1; до 19.02 ещё возможны иные коды расчётов, их цены не смешиваются с TQBR.' if d<='2024-02-19' else 'Нет допустимых кодов расчётов по ГДР; конвертация и редомициляция.')
            rec.update(category='corporate-action',reason=reason+' Оценка условной стоимости, не цена доступной сделки.',sourceIds=['redom','conversion','reopen'],
                status='estimated',method='interpolation' if best=='interpolation' else 'regression',**estimates[d])
            rec['estimatedPrice']=rec['interpolatedPrice'] if best=='interpolation' else rec['regressionPrice']
        else:
            rec.update(category='instrument-calendar',reason='MOEX запретила сделки с T на дополнительной сессии выходного дня 04–05.10.2025. Не заполняется моделью.',sourceIds=['weekend'])
    observations.append(rec)

result={
 'schemaVersion':1,'updatedAt':inputs['fetchedAt'],'marketFileSha256':inputs['marketFileSha256'],
 'inputsFileSha256':sha('public/data/recovery-inputs.json'),'sources':sources,
 'summary':{'dates':len(observations),'missing':24,'actualRecovered':len(inputs['actualPatches']),'estimated':19,'leftUnestimated':5},
 'selectedMethod':best,'selectedFactorModel':factor_method,
 'bridge':{'leftDate':points[left]['date'],'rightDate':points[right]['date'],'leftPrice':points[left]['T'],'rightPrice':points[right]['T'],
   'intervals':right-left,'correction':(math.log(points[right]['T']/points[left]['T'])-sum(sum(c*v for c,v in zip(model['coefficients'],[1.,*features[i]])) for i in range(left+1,right+1)))/(right-left)},
 'models':models,'validation':aggregates,'folds':folds,
 'observations':observations,
 'regimes':[{'from':a,'till':b,'name':name} for a,b,name in REGIMES],
 'methodology':[
  'Ценовые логарифмические доходности T и факторов на одинаковых интервалах календаря IMOEX. Пропуски T не сжимаются в однодневную доходность. Отрезки >7 календарных дней и переходы между режимами не входят в обучение.',
  'OLS обучается только на прошлых наблюдениях того же режима: окно до 252 интервалов, минимум 80 в проверке. Два фактора допускаются при VIF ≤ 5 во всех validation-окнах. Выбор спецификации для остановки 2024 ретроспективен: validation включает также даты после неё; коэффициенты этого моста оценены только до 15.02.2024. Фактические экстремальные доходности и дивидендные падения не обрезаются.',
  'Детерминированные блоки по 3/10/20 торговых дней. Выбор по средней относительной RMSE validation до 2025, test 2025 не участвует в выборе. Перемешивания нет. Результаты по перекрывающимся блокам не являются независимыми оценками точности.',
  'Мост использует известные цены обоих краёв. Поправка δ=(ln(Pправ/Pлев)−Σr̂)/N равномерно распределяется по лог-доходностям. Это ретроспективное сглаживание, не прогноз инвестору на дату пропуска.',
  'Conditional-forward не использует правую цену, но использует фактически реализовавшиеся факторы периода. Это условная проверка доходности, не прогноз неизвестного будущего рынка.',
  'Интервал цены не заявляется: не оценена вероятность траектории во время остановки и структурных событий; остатки могут быть ненормальными и зависимыми. HAC-интервалы коэффициентов не являются интервалами восстановленных цен.',
  'Росбанк: отдельный исследовательский режим с сентября 2024; это граница периметра для проверки, не статистически найденная точная дата разрыва. Поведение при остановке торгов не наблюдается: ошибки обычных торговых блоков не доказывают точность условных цен.',
  'Восстановление цены не оценивает EPS, неизвестные дивиденды и вероятность позитивного сценария. Основная историческая статистика и оптимизация используют только исходные фактические цены.'
 ]}

# Standalone evidence figure: actual price gaps remain gaps; conditional paths are dashed.
selected=[q for q in observations if '2024-02-01'<=q['date']<='2024-03-29']
values=[p for q in selected for p in [q['actualPrice'],q['estimatedPrice']] if p is not None]
lo,hi=min(values)*.99,max(values)*1.01
xy=lambda i,p:f'{65+i*860/(len(selected)-1):.2f},{315-(p-lo)*245/(hi-lo):.2f}'
segments=[];segment=[]
for i,q in enumerate(selected):
    if q['actualPrice'] is None:
        if segment: segments.append(segment); segment=[]
    else:segment.append(xy(i,q['actualPrice']))
if segment:segments.append(segment)
lines=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="420" viewBox="0 0 1000 420"><rect width="1000" height="420" fill="#141c28"/><g fill="#edf1f7" font-family="Arial" font-size="16"><text x="65" y="30">Т-Технологии: фактические и условные цены, ₽ (база сплита 1:10)</text>']
for k in range(5):
    y=315-k*245/4; p=lo+(hi-lo)*k/4
    lines.append(f'<text x="10" y="{y+5}">{p:.1f}</text><path d="M65 {y}H930" stroke="#354052"/>')
for segment in segments: lines.append(f'<polyline points="{" ".join(segment)}" fill="none" stroke="#91b3ff" stroke-width="2.5"/>')
bridge=[xy(i,q['estimatedPrice'] if q['estimatedPrice'] is not None else q['actualPrice']) for i,q in enumerate(selected) if '2024-02-15'<=q['date']<='2024-03-18']
lines.append(f'<polyline points="{" ".join(bridge)}" fill="none" stroke="#e9c97f" stroke-width="2.5" stroke-dasharray="7 5"/>')
for i in [0,len(selected)//2,len(selected)-1]: lines.append(f'<text x="{65+i*860/(len(selected)-1)-35}" y="350">{selected[i]["date"]}</text>')
lines.append('<text x="65" y="390">Синий: фактические TQBR; пунктир: условная стоимость, торги отсутствовали.</text></g></svg>')
encoded=json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
destination=ROOT/'public/data/recovery.json'
if args.check:
    old=json.loads(destination.read_text())
    def same(a,b):
        if isinstance(a,(float,int)) and isinstance(b,(float,int)): return math.isclose(a,b,rel_tol=1e-8,abs_tol=1e-10)
        if isinstance(a,dict) and isinstance(b,dict): return a.keys()==b.keys() and all(same(a[k],b[k]) for k in a)
        if isinstance(a,list) and isinstance(b,list): return len(a)==len(b) and all(same(x,y) for x,y in zip(a,b))
        return a==b
    assert same(result,old),'Research is not reproducible; rebuild and review differences'
    print('Recovery reproduces within numeric tolerance 1e-8')
else:
    tmp=destination.with_suffix('.json.tmp');tmp.write_text(encoded);tmp.replace(destination)
    (ROOT/'docs/examples/recovery-2024.svg').write_text(''.join(lines))
print('Selected:',best,'Factor model:',factor_method,'Gaps:',result['summary'])
for phase in ['validation','test']:
    print(phase,[(m,aggregate(phase,m)) for m in ['interpolation','market','market-sector']])
print('Gap models:',models)
