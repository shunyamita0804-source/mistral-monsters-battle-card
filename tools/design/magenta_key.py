"""マゼンタの背景（#FF00FF の近く。色の揺れあり）を透明にする（2026-10-26 デザイン第11弾。透明の背景で届かなかったため）。

マゼンタらしさ m＝min(赤, 青)−緑。m が 200 以上は透明、80 以下は不透明、その間はなめらかに。
半透明のふちと、ふちに残ったマゼンタのにじみは、赤と青を緑の側へ戻して消す（色の揺れの許容）。
"""

import numpy as np
from PIL import Image

KEY_HI, KEY_LO = 200, 80


def key_magenta(img: Image.Image) -> Image.Image:
    a = np.array(img.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g
    alpha = np.clip((KEY_HI - m) / (KEY_HI - KEY_LO), 0, 1)
    # にじみ取り：マゼンタの分（m の正の分）を、ふちほど強く引く
    spill = np.clip(m, 0, None) * np.where(alpha < 1, 1.0, np.clip((m - 40) / 80, 0, 1))
    out = np.dstack([np.clip(r - spill, 0, 255), g, np.clip(b - spill, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')
