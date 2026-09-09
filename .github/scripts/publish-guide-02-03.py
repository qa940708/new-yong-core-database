#!/usr/bin/env python3
"""Import the two approved guide videos without modifying their audio or video."""
from __future__ import annotations
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path('.')
MEDIA = ROOT / 'assets/guide-media'
MEDIA.mkdir(parents=True, exist_ok=True)
GUIDES = [
    {
        'id': 'travel', 'number': '02', 'title': '操作、移動與地圖',
        'public_title': '練等地圖基礎教學', 'version': 'v3',
        'source_name': 'NEW-YONG-guide-02-travel-preview (1).mp4',
        'sha256': '156542206092972efbe6692742d7bbb07d1de2fc1c829b2e8919456fc924ebf1',
        'bytes': 15779850, 'duration': 85, 'poster_at': 47.2,
        'url': 'https://d2jqrm6oza8nb6.cloudfront.net/datasets/9facc8de-6bad-4c80-a231-5fa626b73b21.mp4?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiYmY1ODg4M2IxMzE5NWIxYiIsImJ1Y2tldCI6InJ1bndheS1kYXRhc2V0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc4OTA1NjY5OX0.ACBk33ttMWa6DMb4yrj587TRhNAyc6fx2ZWcr8BO04Q',
        'headline': '先設定操作，<span>再決定去哪裡。</span>',
        'lead': '1～26 等，以三所學校的校內練等為主。<br>出發前查看公車區間，搭配地圖資訊找怪物與掉落物。',
        'example': '校內設定 → 聖門洞校外',
        'description': 'NEW YONG 練等地圖基礎教學：A／B 熱鍵設定、1～26 等校內練等、公車移動，以及按 M 查詢各地圖的怪物位置與掉落物。',
        'picker': '操作、移動與查圖',
        'note': '依自己的操作習慣選擇熱鍵模式；先查好怪物與掉落物，再決定下一個練等地點。',
        'steps': [
            (0, 12, '熱鍵設定', '選擇 A 模式或 B 模式，完成後套用'),
            (12, 30, '練等區間與公車', '查看目的地的練等區間，選擇地圖與公車站'),
            (30, 40, '聖門洞校外', '抵達怪物區，開始手動練等'),
            (40, 64, '地圖資訊', '按 M 切換「資訊」，查看怪物分布與掉落物'),
            (64, 85, '切換其他地圖', '使用上方切換按鈕，查詢其他區域'),
        ],
        'pictures': [
            (3.2, 'hotkeys', '操作設定', '選擇習慣的熱鍵模式', '開啟熱鍵設定，選擇 A 模式或 B 模式，設定完成後套用。'),
            (47.2, 'map-info', '地圖資訊', '查看怪物與獎勵道具', '按 M 開啟地圖並切換到「資訊」。選擇怪物查看分布，下方獎勵道具可查閱掉落物。'),
            (68.2, 'other-maps', '切換地圖', '出發前，先查其他區域', '使用上方切換按鈕選擇其他地圖，查詢怪物位置與掉落物，再決定練等地點。'),
        ],
    },
    {
        'id': 'collection', 'number': '03', 'title': '收藏使用方式',
        'public_title': '收藏介紹', 'version': 'v2',
        'source_name': 'NEW-YONG-guide-03-collection-preview.mp4',
        'sha256': '2be7be0ffe1cb281f46bc9ce991e28ddc4663f195f3f722d66c463b19d7a0cdd',
        'bytes': 2228038, 'duration': 38, 'poster_at': 7.2,
        'url': 'https://d2jqrm6oza8nb6.cloudfront.net/datasets/b05db521-8bee-45cd-8a0f-763f1a9f3219.mp4?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiNWI0Zjc3NjUwZGI4M2VmNiIsImJ1Y2tldCI6InJ1bndheS1kYXRhc2V0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc4OTA2MDk2NX0.LeA2Wksug1QUqxTGJfAEe5Keq_NIqz9RroYTh8HKAgI',
        'headline': '登錄指定核心，<span>查看收藏成果。</span>',
        'lead': '開啟個人收藏，查看組合需要的核心與能力加成。<br>依序登錄指定道具，最後查看效果與完成進度。',
        'example': '個人收藏・核心登錄',
        'description': 'NEW YONG 收藏介紹：開啟個人收藏、選擇組合、核對指定核心、註冊登錄，以及查看收藏效果與完成進度。',
        'picker': '七步完成收藏操作',
        'note': '「註冊」是遊戲內的按鈕名稱，指將指定核心登錄到收藏。影片為操作示範；需求、成功率與能力數值請以正式遊戲及收藏圖鑑為準。',
        'steps': [
            (0, 4, '開啟個人收藏', '點選畫面下方的「個人收藏」'),
            (4, 10, '選擇收藏組合', '查看能力加成與需要的核心'),
            (10, 15, '核對指定核心', '點選核心圖示，核對名稱與所需數量'),
            (15, 20, '選取道具・按註冊', '選取右側對應道具，再按「註冊」'),
            (20, 26, '依序登錄其他核心', '成功後出現綠色勾勾，繼續登錄'),
            (26, 31, '確認整組完成', '整組登錄完成後，查看完成標記'),
            (31, 38, '查看效果與進度', '按「效果」，查看總加成與收藏進度'),
        ],
        'pictures': [
            (11.2, 'required-core', '核對需求', '確認指定核心', '點選收藏組合中的核心圖示，核對右側的名稱與所需數量。'),
            (17.2, 'register', '登錄道具', '選取道具，再按註冊', '選取右側的對應核心，再按「註冊」。登錄成功後，圖示會出現綠色勾勾。'),
            (32.2, 'effects', '效果與進度', '查看累積的收藏成果', '按下「效果」，查閱能力加成與收藏進度；完成的組合會顯示完成標記。'),
        ],
    },
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def still(video: Path, timestamp: float, output: Path) -> None:
    # Decode from the start, avoiding keyframe-only screenshots at cut boundaries.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-ss', str(timestamp),
                    '-frames:v', '1', '-q:v', '2', str(output)], check=True)
    assert output.stat().st_size > 1000, 'Invalid still image'


def series(active: str) -> str:
    entries = [('start', './', '01', '初入校園'),
               ('travel', './travel.html', '02', '操作、移動與地圖'),
               ('collection', './collection.html', '03', '收藏使用方式')]
    links = []
    for key, href, number, title in entries:
        current = ' aria-current="page"' if key == active else ''
        links.append(f'<a href="{href}"{current}><b>{number}</b><span>{title}</span></a>')
    return '<nav class="guide-series" aria-label="遊玩指南篇章">' + ''.join(links) + '</nav>'


index_path = ROOT / 'guide/index.html'
original = index_path.read_text(encoding='utf-8')
assert '<a href="../features/">功能導覽</a>' in original, 'Unexpected site navigation'
main_tag = '<main id="guide-content" class="play-guide-page">'
assert original.count(main_tag) == 1, 'Unexpected guide layout'
header, rest = original.split(main_tag, 1)
assert rest.count('</main>') == 1
footer = re.search(r'<footer class="site-footer">.*?</footer>', rest, flags=re.S)
assert footer, 'Missing existing site footer'
style_link = '<link rel="stylesheet" href="../assets/guide-series.css?v=guide-02-03-v1">'
if style_link not in header:
    header = header.replace('</head>', style_link + '\n</head>')

manifest = []
for guide in GUIDES:
    stem = guide['id'] + '-' + guide['version']
    video = MEDIA / (stem + '.mp4')
    if video.exists():
        assert digest(video) == guide['sha256'], 'Refusing to replace a different existing video'
    else:
        try:
            with urllib.request.urlopen(guide['url'], timeout=120) as response:
                payload = response.read(guide['bytes'] + 1)
        except Exception:
            raise RuntimeError('Transfer failed for ' + guide['id']) from None
        assert len(payload) == guide['bytes'], 'Unexpected source size'
        assert hashlib.sha256(payload).hexdigest() == guide['sha256'], 'Source checksum mismatch'
        video.write_bytes(payload)
    metadata = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(video)]))
    streams = metadata['streams']
    v = next(s for s in streams if s['codec_type'] == 'video')
    a = next(s for s in streams if s['codec_type'] == 'audio')
    assert v['codec_name'] == 'h264' and a['codec_name'] == 'aac'
    assert (v['width'], v['height']) == (1040, 848)
    assert abs(float(metadata['format']['duration']) - guide['duration']) < 0.05
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True)
    still(video, guide['poster_at'], MEDIA / (stem + '.jpg'))
    buttons = []
    for number, (start, end, title, subtitle) in enumerate(guide['steps'], 1):
        time = f'{start // 60}:{start % 60:02d}'
        buttons.append(f'<button type="button" class="chapter-button" data-seek="{start}" data-end="{end}" aria-label="播放：{html.escape(title)}"><span class="step-number">{number:02d}</span><span><strong>{html.escape(title)}</strong><small>{html.escape(subtitle)}</small></span><time>{time}</time></button>')
    pictures = []
    for timestamp, key, label, title, text in guide['pictures']:
        filename = stem + '-' + key + '.jpg'
        still(video, timestamp, MEDIA / filename)
        src = '../assets/guide-media/' + filename
        pictures.append(f'<article class="picture-card"><a href="{src}" target="_blank" rel="noopener" aria-label="查看{html.escape(title)}原圖"><img src="{src}" alt="{html.escape(title)}實機操作畫面" width="1040" height="848" loading="lazy"></a><div><span class="detail-label">{label}</span><h3>{title}</h3><p>{text}</p></div></article>')
    page_header = re.sub(r'<title>.*?</title>', 'NEW_TITLE', header, count=1)
    page_header = page_header.replace('NEW_TITLE', f'<title>NEW YONG｜遊玩指南 {guide["number"]}・{guide["title"]}</title>')
    page_header = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(guide["description"], quote=True)}">', page_header, count=1)
    page_header = page_header.replace('https://newyongdata.online/guide/"', f'https://newyongdata.online/guide/{guide["id"]}.html"')
    page_header = page_header.replace('class="play-guide"', 'class="play-guide guide-series-page"')
    duration = f'{guide["duration"] // 60}:{guide["duration"] % 60:02d}'
    src = '../assets/guide-media/' + stem + '.mp4'
    aside = ('<aside class="supply-help"><div><strong>查詢收藏需求與能力加成</strong><p>前往收藏圖鑑，查閱各組收藏的指定核心與效果。</p></div><a href="../collections/">查看收藏圖鑑 <span aria-hidden="true">↗</span></a></aside>'
             if guide['id'] == 'collection' else
             '<aside class="supply-help"><div><strong>打到核心後，了解收藏怎麼使用</strong><p>下一篇接著示範核心登錄與收藏效果查詢。</p></div><a href="./collection.html">查看收藏介紹 <span aria-hidden="true">↗</span></a></aside>')
    body = f'''{main_tag}
{series(guide['id'])}
<section class="chapter-intro" aria-labelledby="chapter-title">
<div><p class="chapter-eyebrow">遊玩指南 <span>{guide['number']} / {guide['public_title']}</span></p><h1 id="chapter-title">{guide['headline']}</h1><p class="chapter-lead">{guide['lead']}</p></div>
<div class="example-tag"><span>本篇實機示範</span><strong>{guide['example']}</strong></div>
</section>
<section class="walkthrough" aria-label="{guide['title']}實機教學">
<div class="guide-player">
<video id="guide-video" controls playsinline preload="metadata" poster="../assets/guide-media/{stem}.jpg" width="1040" height="848" aria-label="{guide['public_title']}，含繁體中文字幕與中文旁白，片長 {duration}">
<source src="{src}" type="video/mp4">你的瀏覽器不支援影片播放，可使用下方連結觀看。</video>
<div class="player-meta"><span>實機操作・繁體字幕・中文旁白｜{duration}</span><a href="{src}" download>下載影片</a></div>
<p id="guide-video-error" class="video-error" role="status" hidden>影片暫時無法載入，請重新整理或使用下載影片連結。下方圖文仍可查閱。</p>
</div>
<div class="chapter-picker"><div class="picker-heading"><h2>{guide['picker']}</h2><button type="button" class="restart-video" data-seek="0">從頭播放</button></div>
<p class="picker-hint">選擇步驟，跳到對應操作。</p><div class="chapter-buttons" role="group" aria-label="影片章節">{''.join(buttons)}</div><p class="chapter-note">{guide['note']}</p></div>
</section>
<section class="picture-guide" aria-labelledby="picture-guide-title"><div class="section-heading"><h2 id="picture-guide-title">操作重點回顧</h2><span>點選圖片可查看原尺寸</span></div><div class="picture-grid">{''.join(pictures)}</div></section>
{aside}
<nav class="chapter-connections" aria-label="切換遊玩指南">{series(guide['id'])}</nav>
{footer.group(0)}
</main><script src="../assets/guide.js?v=guide-v1" defer></script>
</body></html>
'''
    page_path = ROOT / 'guide' / (guide['id'] + '.html')
    page_path.write_text(page_header + body, encoding='utf-8')
    manifest.append({
        'id': guide['id'], 'title': guide['title'], 'publicTitle': guide['public_title'],
        'sourceFilename': guide['source_name'], 'page': 'guide/' + guide['id'] + '.html',
        'video': 'assets/guide-media/' + video.name,
        'poster': 'assets/guide-media/' + stem + '.jpg',
        'duration': guide['duration'], 'width': 1040, 'height': 848,
        'hasAudio': True, 'sha256': guide['sha256'], 'bytes': guide['bytes'],
        'sourcePreserved': True, 'chapters': [s[0] for s in guide['steps']],
    })
    print('Verified original media and prepared page:', guide['id'], duration, guide['sha256'])

# Add only series navigation to the original chapter. Preserve its content and player.
if 'class="guide-series"' not in rest:
    rest = '\n' + series('start') + '\n' + rest
index_path.write_text(header + main_tag + rest, encoding='utf-8')
assert '../assets/guide-media/start-v1.mp4' in index_path.read_text(encoding='utf-8')
(ROOT / 'assets/guide-series.css').write_text('''/* guide-02-03-v1: additive styles; existing guide and catalog styles are unchanged. */
.guide-series{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 28px}
.guide-series>a{display:flex;align-items:center;gap:11px;min-height:48px;padding:12px 18px;border:1px solid #654824;border-radius:10px;background:#171109;color:#cbb998;text-decoration:none;line-height:1.5}
.guide-series>a>b{color:#d6a854;font-size:.875rem}
.guide-series>a[aria-current=page]{border-color:#c7984c;background:#332411;color:#ffe0a2}
.guide-series>a:hover{border-color:#d7a757;background:#2c2011}
.guide-series-page .guide-player video{aspect-ratio:1040/848}
.guide-series-page .chapter-button{min-height:72px;padding:11px 12px}
.guide-series-page .picture-card img{aspect-ratio:1040/848}
.chapter-connections{margin-top:28px}
.chapter-connections .guide-series{margin-bottom:0}
@media(max-width:850px){.guide-series-page .chapter-buttons{grid-template-columns:1fr}}
@media(max-width:540px){.guide-series{display:grid;grid-template-columns:minmax(0,1fr);gap:9px}.guide-series>a{min-width:0;padding:12px 15px}.guide-series-page .picker-heading{flex-wrap:wrap}.guide-series-page .chapter-button{grid-template-columns:32px minmax(0,1fr) auto;gap:9px}.guide-series-page .step-number{width:32px;height:34px}.guide-series-page .chapter-eyebrow span{display:block;margin:7px 0 0}}
''', encoding='utf-8')
(MEDIA / 'guide-02-03-manifest.json').write_text(json.dumps({
    'release': 'guide-02-03-v1',
    'notes': 'Original user-approved MP4 bytes. Website playback uses repository media, not temporary transfer URLs.',
    'guides': manifest,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
subprocess.run(['node', '--check', 'assets/guide.js'], check=True)
print('Prepared both guides. No catalog data or existing video was modified.')
