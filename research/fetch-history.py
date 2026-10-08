import json, urllib.request, urllib.parse, time, datetime, pathlib
symbols='BTC ETH SOL XRP ADA DOGE AVAX LINK LTC BCH'.split()
# Fixed sample, selected before strategy evaluation. Seven completed UTC days.
end=int(datetime.datetime(2026,10,2,tzinfo=datetime.timezone.utc).timestamp())
start=end-7*86400
out={}
for sym in symbols:
    rows={}
    for a in range(start,end,86400):
        params=urllib.parse.urlencode({'granularity':300,'start':datetime.datetime.fromtimestamp(a,datetime.timezone.utc).isoformat(),'end':datetime.datetime.fromtimestamp(a+86400,datetime.timezone.utc).isoformat()})
        url=f'https://api.exchange.coinbase.com/products/{sym}-USD/candles?{params}'
        for retry in range(3):
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'PrashantVerse-research/2'})
                data=json.load(urllib.request.urlopen(req,timeout=20))
                if not isinstance(data,list): raise ValueError(str(data))
                for row in data:
                    if start<=row[0]<end: rows[row[0]]=row
                break
            except Exception:
                if retry==2: raise
                time.sleep(1)
        time.sleep(.2)
    out[sym]=[rows[t] for t in sorted(rows)]
    print(sym,len(rows),flush=True)
pathlib.Path(__file__).with_name('history.json').write_text(json.dumps({'start':start,'end':end,'data':out}))
