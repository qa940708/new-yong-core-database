#!/usr/bin/env python3
"""Publish only the approved guide-04 release, preserving all earlier content."""
import hashlib
import html
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / 'assets/guide-media'
VIDEO = MEDIA / 'core-v2.mp4'
EXPECTED_BYTES = 8569553
EXPECTED_SHA = 'e660357830aff5d41fb1221543d66cfb6202aaf7c4bdf3a4af5c8b45f9a32f4e'
DURATION = 79.3
CHAPTERS = [
    (0, 4.5, '確認核心槽', '打開背包，先查看裝備的核心槽'),
    (4.5, 13, '使用開孔器', '成功一次開一孔，每件裝備最多三孔'),
    (13, 24, '開孔可能失敗', '未達 100% 就可能失敗；開孔器會消耗'),
    (24, 39, '裝入核心', '選取核心，對裝備使用，每孔一顆'),
    (39, 55, '一次移除全部核心', '核心返回背包；不能指定單一孔位'),
    (55, 67, '同類核心不可重複', '同一件裝備，每種類別最多一顆'),
    (67, 79.3, '確認裝備配置', '武器與防具皆適用；最多三顆、類別不重複'),
]
CUES = [
    (0.25, 4.4, '先打開背包，確認裝備的核心槽。'),
    (4.6, 8.85, '選取開孔器，移到裝備上按右鍵。'),
    (9, 12.85, '每次成功開啟一孔，每件裝備最多三孔。'),
    (13.15, 17.9, '開孔前先看成功率，未達百分之百就有機會失敗。'),
    (18.05, 23.85, '失敗會消耗開孔器，但不會損壞裝備或清除原有孔位。'),
    (24.15, 28.85, '開好孔後，選取核心，對裝備使用。'),
    (29, 33.85, '每個孔位只能裝一顆核心。'),
    (34, 38.85, '裝好後，查看核心圖示與新增的能力。'),
    (39.1, 43.45, '想更換配置，選取核心移除器，對裝備按右鍵。'),
    (43.6, 48.25, '移除必定成功，而且會一次取下全部核心。'),
    (48.4, 51.65, '所有核心會返回背包，移除器會消耗。'),
    (51.8, 54.85, '不能指定只移除其中一孔。'),
    (55, 59.45, '同一件裝備中，每種類別的核心最多只能裝一顆。'),
    (59.6, 63.4, '已經裝入的類別，就不能再重複裝入。'),
    (63.55, 66.85, '剩餘孔位，請選擇其他類別的核心。'),
    (67.05, 72.85, '武器和防具，都要遵守同樣的核心規則。'),
    (73, 79.1, '最多三顆、類別不重複；裝好後再確認能力。'),
]
SERIES_RE = re.compile(r'<nav class="guide-series" aria-label="遊玩指南篇章">.*?</nav>', re.S)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def navigation(active):
    entries = [('./', '初入校園'), ('./travel.html', '操作、移動與地圖'),
               ('./collection.html', '收藏使用方式'), ('./core.html', '裝備核心')]
    links = []
    for index, (url, title) in enumerate(entries, 1):
        current = ' aria-current="page"' if index == active else ''
        links.append(f'<a href="{url}"{current}><b>{index:02d}</b><span>{title}</span></a>')
    return '<nav class="guide-series" aria-label="遊玩指南篇章">' + ''.join(links) + '</nav>'


def timestamp(value):
    milliseconds = round(value * 1000)
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f'{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}'


def main():
    assert (ROOT / 'CNAME').read_text().strip() == 'newyongdata.online'
    MEDIA.mkdir(parents=True, exist_ok=True)
    if not VIDEO.exists() or sha256(VIDEO) != EXPECTED_SHA:
        url = os.environ['GUIDE_04_SOURCE_URL']
        assert url.startswith('https://')
        request = urllib.request.Request(url, headers={'User-Agent': 'NEW-YONG-guide-publisher/1.0'})
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read(EXPECTED_BYTES + 1)
        assert len(data) == EXPECTED_BYTES, 'Wrong video length'
        assert hashlib.sha256(data).hexdigest() == EXPECTED_SHA, 'Unapproved video bytes'
        temporary = VIDEO.with_suffix('.mp4.part')
        temporary.write_bytes(data)
        temporary.replace(VIDEO)
    assert VIDEO.stat().st_size == EXPECTED_BYTES and sha256(VIDEO) == EXPECTED_SHA
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format',
        '-show_streams', '-show_chapters', '-of', 'json', str(VIDEO)], text=True))
    assert abs(float(probe['format']['duration']) - DURATION) < .05
    video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
    audio = next(stream for stream in probe['streams'] if stream['codec_type'] == 'audio')
    assert (video['codec_name'], video['width'], video['height']) == ('h264', 1040, 848)
    assert audio['codec_name'] == 'aac' and audio['channels'] == 2
    assert len(probe['chapters']) == 7
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(VIDEO), '-map', '0:v:0',
        '-map', '0:a:0', '-f', 'null', '-'], check=True)
    for suffix, seconds in [('', 1), ('-opening', 18.5), ('-removal', 47.5), ('-unique', 62)]:
        subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(seconds), '-i', str(VIDEO),
            '-frames:v', '1', '-q:v', '2', '-y', str(MEDIA / f'core-v2{suffix}.jpg')], check=True)

    # Reuse the current site's header and styles, without editing shared CSS/JS.
    original = (ROOT / 'guide/collection.html').read_text()
    prefix = original.split('<section class="chapter-intro"', 1)[0]
    assert '<main id="guide-content"' in prefix and len(SERIES_RE.findall(prefix)) == 1
    prefix = prefix.replace('https://newyongdata.online/guide/collection.html',
                            'https://newyongdata.online/guide/core.html')
    prefix = re.sub(r'<meta name="description" content="[^"]*">',
        '<meta name="description" content="NEW YONG 裝備核心實機教學：使用開孔器、開孔失敗規則、安裝核心、一次移除全部核心，以及同件裝備每種類別不可重複的限制。">', prefix, count=1)
    prefix = re.sub(r'<title>.*?</title>', '<title>NEW YONG｜遊玩指南 04・裝備核心</title>', prefix, count=1)
    prefix = SERIES_RE.sub(lambda _: navigation(4), prefix)
    buttons = []
    for index, (start, end, title, description) in enumerate(CHAPTERS, 1):
        label = f'{int(start) // 60}:{int(start) % 60:02d}'
        buttons.append(f'<button type="button" class="chapter-button" data-seek="{start}" data-end="{end}" aria-label="播放：{html.escape(title)}"><span class="step-number">{index:02d}</span><span><strong>{html.escape(title)}</strong><small>{html.escape(description)}</small></span><time>{label}</time></button>')
    cards = []
    content = [
        ('opening', '開孔與失敗', '先看成功率，再使用開孔器', '每次成功開啟一孔，每件裝備最多三孔。未達 100% 成功率的開孔器有機會失敗；失敗會消耗開孔器，但不會損壞裝備或清除原有孔位。'),
        ('removal', '移除核心', '必定成功，一次取下全部核心', '選取核心移除器，對裝備按右鍵使用。所有核心會返回背包，移除器會消耗；不能指定只移除其中一孔。'),
        ('unique', '核心類別限制', '同一件裝備，每種類別最多一顆', '每個孔位只能裝一顆核心，每件裝備最多三顆。同一類別不能重複裝入，剩餘孔位需選擇其他類別。武器與防具都適用。'),
    ]
    for suffix, label, title, description in content:
        image = f'../assets/guide-media/core-v2-{suffix}.jpg'
        cards.append(f'<article class="picture-card"><a href="{image}" target="_blank" rel="noopener" aria-label="查看{title}原圖"><img src="{image}" alt="{label}實機操作畫面" width="1040" height="848" loading="lazy"></a><div><span class="detail-label">{label}</span><h3>{title}</h3><p>{description}</p></div></article>')
    body = '''<section class="chapter-intro" aria-labelledby="chapter-title">
<div><p class="chapter-eyebrow">遊玩指南 <span>04 / 裝備核心</span></p><h1 id="chapter-title">裝備開孔，<span>掌握核心配置。</span></h1><p class="chapter-lead">從開孔、裝入到移除，跟著實機操作了解核心系統。<br>每件裝備最多三顆核心，同一類別不可重複。</p></div>
<div class="example-tag"><span>本篇實機示範</span><strong>裝備開孔・核心安裝與移除</strong></div></section>
<section class="walkthrough" aria-label="裝備核心實機教學"><div class="guide-player">
<video id="guide-video" controls playsinline preload="metadata" poster="../assets/guide-media/core-v2.jpg" width="1040" height="848" aria-label="裝備核心實機教學，含繁體中文字幕、中文旁白、背景音樂與提示音效，片長 1:19">
<source src="../assets/guide-media/core-v2.mp4" type="video/mp4">你的瀏覽器不支援影片播放，可使用下方連結觀看。</video>
<div class="player-meta"><span>實機操作・繁體字幕・中文旁白・配樂音效｜1:19</span><a href="../assets/guide-media/core-v2.mp4" download>下載影片</a></div>
<p id="guide-video-error" class="video-error" role="status" hidden>影片暫時無法載入，請重新整理或使用下載影片連結。下方圖文仍可查閱。</p></div>
<div class="chapter-picker"><div class="picker-heading"><h2>七段掌握裝備核心</h2><button type="button" class="restart-video" data-seek="0">從頭播放</button></div>
<p class="picker-hint">選擇章節，跳到對應操作與規則說明。</p><div class="chapter-buttons" role="group" aria-label="影片章節">''' + ''.join(buttons) + '''</div>
<p class="chapter-note">同一件裝備可搭配不同類別的核心，但每種類別最多一顆。最多三孔、每孔一顆；武器與防具的規則相同。</p></div></section>
<section class="picture-guide" aria-labelledby="picture-guide-title"><div class="section-heading"><h2 id="picture-guide-title">三個一定要知道的核心規則</h2><span>點選圖片可查看原尺寸</span></div><div class="picture-grid">''' + ''.join(cards) + '''</div></section>
<aside class="supply-help"><div><strong>查詢每顆核心的能力與掉落資訊</strong><p>前往核心圖鑑，依自己的玩法查閱核心資料。</p></div><a href="../">查看核心圖鑑 <span aria-hidden="true">↗</span></a></aside>
<nav class="chapter-connections" aria-label="切換遊玩指南">''' + navigation(4) + '''</nav>
<footer class="site-footer">NEW YONG CLASSIC EP9｜遊玩指南<br>操作畫面為實機錄影；道具與功能內容以正式遊戲版本為準。</footer>
</main><script src="../assets/guide.js?v=guide-v1" defer></script>
</body></html>
'''
    (ROOT / 'guide/core.html').write_text(prefix + body)
    preserved = []
    for index, name in enumerate(['index.html', 'travel.html', 'collection.html'], 1):
        page = ROOT / 'guide' / name
        before = page.read_text()
        after, count = SERIES_RE.subn(lambda _: navigation(index), before)
        assert count in (1, 2), f'Unexpected navigation in {name}'
        assert SERIES_RE.sub('', before) == SERIES_RE.sub('', after), 'Earlier guide content altered'
        page.write_text(after)
        preserved.append({'page': 'guide/' + name, 'outside_series_navigation_unchanged': True})
    vtt = 'WEBVTT\n\n' + '\n\n'.join(f'{index}\n{timestamp(start)} --> {timestamp(end)}\n{text}'
        for index, (start, end, text) in enumerate(CUES, 1)) + '\n'
    (MEDIA / 'core-v2.vtt').write_text(vtt)
    chapters = [{'start': start, 'end': end, 'number': f'{index:02d}', 'title': title}
        for index, (start, end, title, _) in enumerate(CHAPTERS, 1)]
    (MEDIA / 'core-v2-chapters.json').write_text(json.dumps(chapters, ensure_ascii=False, indent=2) + '\n')
    manifest = {'title': '遊玩指南 04・裝備核心', 'page': 'guide/core.html',
        'video': 'assets/guide-media/core-v2.mp4', 'bytes': EXPECTED_BYTES, 'sha256': EXPECTED_SHA,
        'duration_seconds': DURATION, 'width': 1040, 'height': 848, 'video_codec': 'h264',
        'audio_codec': 'aac', 'audio_channels': 2, 'chapters': chapters,
        'original_approved_video_unchanged': True, 'earlier_guides': preserved}
    (MEDIA / 'core-v2-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    assert sha256(VIDEO) == EXPECTED_SHA
    print('PREPARED: exact approved 8,569,553-byte H.264/AAC video; seven chapters; earlier guide content preserved')


if __name__ == '__main__':
    main()
