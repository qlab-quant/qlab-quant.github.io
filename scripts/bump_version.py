"""
HTML 파일이 불러오는 우리 CSS · JS 주소 뒤에 버전(?v=...)을 붙이거나 새로 바꿉니다.

GitHub Pages는 브라우저에 파일을 10분 동안 기억하라고 알려 줍니다. 그래서 코드를 고쳐 올리면
새 HTML과 예전 JS가 섞여 화면이 깨질 수 있어요. 버전이 바뀌면 브라우저가 새 파일을 받아 옵니다.

css/ 나 js/ 파일을 고친 뒤 push 하기 전에 실행하세요:
    python3 scripts/bump_version.py
(관리 페이지에서 내용만 저장할 때는 필요 없습니다.)
"""

import pathlib
import re
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = time.strftime("%Y%m%d%H%M")
ASSET = re.compile(r'((?:href|src)="/?(?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=[\w-]*)?(")')

for page in sorted(ROOT.glob("*.html")):
    text = page.read_text(encoding="utf-8")
    updated, count = ASSET.subn(rf"\g<1>?v={VERSION}\g<2>", text)
    if count:
        page.write_text(updated, encoding="utf-8")
        print(f"{page.name}: {count}개 주소에 v={VERSION}")
