import json, base64, os
man=json.load(open('manifest.json'))
src=open('game.src.html',encoding='utf-8').read()
M=json.dumps(man,ensure_ascii=False,separators=(',',':'))
open('index.html','w',encoding='utf-8').write(src.replace('/*MANIFEST*/null',M).replace('/*INLINE*/null','null'))
inl={f:'data:image/png;base64,'+base64.b64encode(open('assets/'+f,'rb').read()).decode() for f in os.listdir('assets')}
open('survivor_burst_single.html','w',encoding='utf-8').write(src.replace('/*MANIFEST*/null',M).replace('/*INLINE*/null',json.dumps(inl,separators=(',',':'))))
print('single', os.path.getsize('survivor_burst_single.html')/1048576,'MB')
