# Recherche rapide dans la table Ciqual compactée : python3 scripts/ciq.py "poulet" "riz"
import json, sys, unicodedata, re
d = json.load(open('public/data/ciqual.json'))
def norm(t): return ''.join(c for c in unicodedata.normalize('NFD', t.lower()) if unicodedata.category(c) != 'Mn')
for q in sys.argv[1:]:
    words = norm(q).split()
    hits = [f for f in d['aliments'] if all(w in norm(f[1]) for w in words)]
    print(f'== {q} ({len(hits)})')
    for f in sorted(hits, key=lambda f: len(f[1]))[:12]: print(f'  {f[0]:>6} {f[3]:>4} kcal  {f[1]}')
