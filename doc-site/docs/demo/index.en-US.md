---
nav: DEMO
order: 0
group:
  order: 0
---

# Foreword

The left side contains several demos to experience, which are based on the [WebAV project][2] to implement various examples of processing audio and video data in a pure browser environment.

```tsx
import { Combinator } from '@webav/av-cliper';
import React, { useState, useEffect } from 'react';

export default function UI() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const msg =
    isSupported == null
      ? 'checking'
      : isSupported === true
        ? '🎉 The current browser supports WebCodecs, you can continue to experience the DEMO 🎉'
        : '💔 WebCodecs is not supported in current browsers, please use Chrome, Edge (and upgrade to a newer version) to experience ❤️‍🩹';

  useEffect(() => {
    (async () => {
      setIsSupported(await Combinator.isSupported());
    })();
  }, []);
  return <strong>{msg}</strong>;
}
```

## Before the DEMO

1.  Make sure your browser supports the WebCodecs API (Chrome 94+), see details [1]
2.  Audio and video resources are hosted on Github Pages, devices without a scientific connection may need to **wait patiently for resources to load**

    1. It is better to have scientific access to the Internet, otherwise the resources may fail to load
    2. Or try an example like **video recording** that doesn't require loading video assets
    3. You can also clone [WebAV project][2] and run it locally

    [1]: https://caniuse.com/?search=WebCodecs
    [2]: https://github.com/bilibili/WebAV
