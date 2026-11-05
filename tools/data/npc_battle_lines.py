"""NPC バトルセリフ 43 名（2026-11-05）の正本 JSON から、ゲームの表 src/data/npcBattleLines.generated.ts を作る。
python3 -I tools/data/npc_battle_lines.py
- 日本語：design-parts/npc-battle-lines-20261105/data/npc_battle_lines.json（ユーザー承認の正本。一字一句そのまま）
- 英語：design-parts/npc-battle-lines-20261105/en_provisional_claude.json（**仮訳・未承認**）
- 対戦相手の ID・顔のキーは正本のまま（opponent_ids・opponent_faces）
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design-parts/npc-battle-lines-20261105')
d = json.load(open(os.path.join(SRC, 'data/npc_battle_lines.json'), encoding='utf-8'))
en = json.load(open(os.path.join(SRC, 'en_provisional_claude.json'), encoding='utf-8'))['en']

js = lambda v: json.dumps(v, ensure_ascii=False)
out = [
    '// このファイルは tools/data/npc_battle_lines.py が作る（手で書きかえない）。',
    '// 正本：design-parts/npc-battle-lines-20261105/data/npc_battle_lines.json（日本語はユーザー承認・一字一句そのまま）。英語は仮訳（未承認）',
    "import type { NpcBattleActor } from './npcBattleLines.ts';",
    '',
    'export const NPC_BATTLE_ACTORS: readonly NpcBattleActor[] = [',
]
for a in d['actors']:
    e = en[a['id']]
    lines = {k: {'ja': v['text'], 'en': e[k], 'status': v['status']} for k, v in a['lines'].items()}
    extra = {}
    for k, v in d['extra_lines'].get(a['id'], {}).items():
        extra[k] = {'ja': v['text'], 'en': e[k], 'status': v['status']}
    item = {'id': a['id'], 'opponentIds': a.get('opponent_ids') or [], 'opponentFaces': a.get('opponent_faces') or [], 'status': a['status'], 'lines': lines}
    if extra:
        item['extra'] = extra
    out.append(f'  {js(item)},')
out.append('];')
out.append('')
path = os.path.join(ROOT, 'src/data/npcBattleLines.generated.ts')
open(path, 'w', encoding='utf-8').write('\n'.join(out))
print(path, len(d['actors']))
