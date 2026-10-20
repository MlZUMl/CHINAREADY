# Convertit la table officielle Ciqual 2020 (Anses, Licence Ouverte Etalab) en un JSON compact
# utilisé hors ligne par l'appli. Usage : python3 scripts/ciqual.py
# Source : Anses. 2020. Table de composition nutritionnelle des aliments Ciqual. https://ciqual.anses.fr
import json, re, sys, unicodedata
import xlrd

SRC = 'scripts/data/ciqual-2020.xls'
OUT = 'public/data/ciqual.json'

def norm(t):
    t = unicodedata.normalize('NFD', t.lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')

def num(v):
    if isinstance(v, float): return v
    v = (v or '').strip().replace(',', '.')
    if v in ('', '-'): return None
    if v.lower() == 'traces' or v.startswith('<'): return 0.0
    try: return float(v)
    except ValueError: return None

# --- règle « sans porc » (contrainte permanente de l'appli) -----------------------------
# 1. Des expressions sûres précises sont retirées du nom (ex. « jambon de dinde »).
# 2. S'il reste un mot qui désigne du porc ou une préparation qui en contient : aliment exclu.
# 3. S'il reste un mot de composition variable (bolognaise, bonbon, bouillon…) : « à vérifier ».
SAFE_PHRASES = [r'jambon (de )?(dinde|poulet|volaille)', r'saucisses? (de )?(volaille|poulet|dinde)', r'chorizo (de )?volaille',
    r'specialite vegetale type (jambon|pate)', r'museau de boeuf', r'pain pour hamburger ou hot dog', r'nem ou pate imperial, (au poulet|aux crevettes)',
    r'gelatine (bovine|vegetale)', r'saucisses? vegetales?', r'rillettes de (thon|saumon|sardine|maquereau|crabe)', r'merguez, boeuf et mouton']
PORK = [r'\bporc', r'\bcochon', r'\bjambon', r'\blardon', r'\bbacon', r'\bsaucisson', r'\bchorizo',
        r'\bsaucisse', r'\bandouille', r'\bboudin', r'\bmousse de foie', r'\blard\b', r'\bsaindoux', r'\bcervelas', r'\bmortadelle',
        r'\bsalami', r'\bcoppa', r'\bpancetta', r'\brosette', r'\bchipolata', r'\bknack', r'\bfrancfort', r'\bstrasbourg',
        r'\bquiche lorraine', r'\btartiflette', r'choucroute garnie', r'\bcassoulet', r'\bcroque.monsieur', r'\bhot.dog', r'\bpotee',
        r'\bpetit sale', r'\bflammekueche', r'\btarte flambee', r'\bcarbonara', r'\bgelatine', r'\bfromage de tete', r'\bmuseau',
        r'\bcouenne', r'\bgratton', r'\bgalantine', r'\bsanglier', r'\bmarcassin', r'\btravers', r'\bechine', r'\bpalette\b',
        r'\bpied de porc', r'\bjesus\b', r'\bfilet mignon', r'\bpoitrine fumee', r'\bbaeckeoffe', r'\bjambonneau', r'\bcrepinette',
        r'\bpepperoni', r'\bpizza.*(reine|royale|savoyarde|calzone|speck)', r'sandwich.*\bpate\b', r'\bspeck']
UNSURE_SAFE = [r'pate a pizza', r'base de pizza', r'pizza, sauce garniture', r'court-bouillon', r'bouillon de (legumes|volaille|boeuf)',
    r'nuggets (de ble|soja)', r'lait gelifie', r'gelifiant pour confiture', r'lasagnes ou cannellonis (au fromage|au poisson|aux legumes)',
    r'pates fraiches farcies \(ex : [^)]*\), (au fromage|aux legumes)', r'raviolis? (au tofu|aux legumes|chinois a la vapeur a la crevette)',
    r'sauce vegetale type bolognaise', r'pizza au fromage ou pizza margherita', r'pizza (4 fromages|au thon|au saumon|aux fruits de mer|aux legumes|champignons fromage|au poulet)',
    r'tarte ou tourte aux poireaux', r'feuillete ou friand au fromage', r'bouchee a la reine, au poisson', r'goûter sec fourre',
    r'sandwich baguette, (camembert|crudites diverses|oeuf|poulet|dinde|thon|saumon fume)', r'sandwich pain de mie complet, (poulet|thon)',
    r'burger au (poisson|poulet)', r'gratin de poisson', r'parmentier de canard']
UNSURE = [r'a la viande', r'\bbolognaise', r'\bravioli', r'\bcannelloni', r'\blasagne', r'\bbonbon', r'\bguimauve', r'\bmarshmallow',
          r'bonbon gelifie', r'\bnougat', r'\bfriand', r'\bsandwich\b', r'\bwrap', r'\bburger', r'\bhamburger', r'\bcheeseburger',
          r'\bnem\b', r'\bsamoussa', r'\bsamossa', r'\bkebab', r'couscous royal', r'\bbouillon', r'\bfond de',
          r'\bmerguez', r'\bfarce\b', r'\bvol.au.vent', r'\bbouchee a la reine', r'\bchili con carne', r'\bmoussaka', r'\bparmentier',
          r'\bpizza', r'\bquiche', r'\btourte\b', r'\bpaella', r'\btarte .*salee', r'pates fraiches farcies']
# Pâtés, terrines, rillettes : exclus s'ils sont de porc ou « de campagne » ; sinon composition à vérifier
# (la farce du commerce contient souvent du gras de porc). L'accent distingue « pâté » de « pâte ».
CHARC = re.compile(r'(pâté|terrine|rillette)')
CHARC_PORK = re.compile(r'(porc|campagne|breton|en croûte|du mans|de tours|traditionnelle|\(aliment moyen\)|au poivre|forestier|champignons|^pâté$)')
CHARC_SAFE = re.compile(r'(spécialité végétale|pâté impérial, (au poulet|aux crevettes)|rillettes de (thon|saumon|crabe|maquereau|sardine)|terrine (de poisson|de fruits de mer|ou mousse de légumes))')

def pork_status(name):
    n = norm(name)
    for sp in SAFE_PHRASES: n = re.sub(sp, ' ', n)
    if any(re.search(p, n) for p in PORK): return 'porc'
    low = name.lower()
    if CHARC.search(low) and not CHARC_SAFE.search(low):
        return 'porc' if CHARC_PORK.search(low) else 'incertain'
    for sp in UNSURE_SAFE: n = re.sub(sp, ' ', n)
    if any(re.search(p, n) for p in UNSURE): return 'incertain'
    return 'ok'

wb = xlrd.open_workbook(SRC)
sh = wb.sheet_by_index(0)
head = sh.row_values(0)
col = {h: i for i, h in enumerate(head)}
C = lambda key: next(i for h, i in col.items() if h.startswith(key))
iK, iKj, iP, iC, iF, iFib, iS = C('Energie, Règlement UE N° 1169/2011 (kcal'), C('Energie, N x facteur Jones, avec fibres  (kcal'), C('Protéines, N x facteur de Jones'), C('Glucides'), C('Lipides'), C('Fibres alimentaires'), C('Sucres')

groups, subgroups, foods, excluded, unsure = {}, {}, [], [], 0
for r in range(1, sh.nrows):
    row = sh.row_values(r)
    name = str(row[col['alim_nom_fr']]).strip()
    code = int(float(row[col['alim_code']]))
    grp = str(row[col['alim_grp_code']]).strip()
    ssgrp = str(row[col['alim_ssgrp_code']]).strip() or (grp + '00')
    groups.setdefault(grp, str(row[col['alim_grp_nom_fr']]).strip() or 'Divers')
    subgroups.setdefault(ssgrp, str(row[col['alim_ssgrp_nom_fr']]).strip() or groups[grp])
    kcal = num(row[iK]); kcal = kcal if kcal is not None else num(row[iKj])
    p, c, f, fib, s = (num(row[i]) for i in (iP, iC, iF, iFib, iS))
    if kcal is None:
        if None in (p, c, f): continue  # pas de valeur énergétique fiable : aliment ignoré
        kcal = 4 * p + 4 * c + 9 * f + 2 * (fib or 0)
    if grp == '11': continue  # aliments infantiles : hors sujet ici
    st = pork_status(name)
    if st == 'porc':
        excluded.append(name); continue
    if st == 'incertain': unsure += 1
    r1 = lambda x: None if x is None else round(x, 1)
    foods.append([code, name, ssgrp, round(kcal), r1(p), r1(c), r1(f), r1(fib), r1(s), 1 if st == 'incertain' else 0])

foods.sort(key=lambda x: x[1])
out = {
    'source': 'Anses. 2020. Table de composition nutritionnelle des aliments Ciqual. Licence Ouverte Etalab.',
    'version': 'Ciqual 2020',
    'fields': ['code', 'nom', 'sous_groupe', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'incertain_porc'],
    'groupes': groups,
    'sous_groupes': subgroups,
    'aliments': foods,
}
with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
with open('scripts/data/ciqual-exclus-porc.txt', 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(sorted(excluded)))
print(f'{len(foods)} aliments gardés, {len(excluded)} exclus (porc), {unsure} marqués « composition à vérifier »')
