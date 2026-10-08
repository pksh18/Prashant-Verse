export const MARKETS = [
 {symbol:'BTC',name:'Bitcoin',icon:'₿',color:'#f5ad48'},
 {symbol:'ETH',name:'Ethereum',icon:'Ξ',color:'#b1aaff'},
 {symbol:'SOL',name:'Solana',icon:'S',color:'#95f4d5'},
 {symbol:'XRP',name:'XRP',icon:'X',color:'#cad7e0'},
 {symbol:'ADA',name:'Cardano',icon:'A',color:'#77b6ff'},
 {symbol:'DOGE',name:'Dogecoin',icon:'Ð',color:'#e7ce7b'},
 {symbol:'AVAX',name:'Avalanche',icon:'A',color:'#ff9393'},
 {symbol:'LINK',name:'Chainlink',icon:'L',color:'#8facff'},
 {symbol:'LTC',name:'Litecoin',icon:'Ł',color:'#b5c9e6'},
 {symbol:'BCH',name:'Bitcoin Cash',icon:'₿',color:'#8eebac'},
 {symbol:'XAU',name:'Spot gold',icon:'Au',color:'#e7c56e'},
] as const;
export type Symbol = string;
export const SYMBOLS:Symbol[]=MARKETS.map(m=>m.symbol);
export const CRYPTO_SYMBOLS=SYMBOLS.filter((s):s is Exclude<Symbol,'XAU'>=>s!=='XAU');
export const CAPITAL=100000, LIMIT=100, ALLOCATION=5000;
