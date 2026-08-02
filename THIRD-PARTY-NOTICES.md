# Third-party notices

Petits Signes is licensed under the GNU AGPL v3.0 or later (see [`LICENSE`](LICENSE)
and [`NOTICE`](NOTICE)). This file covers software written by other people that is
**redistributed to visitors' browsers** as part of the built site.

It exists because those licences ask for it. MIT requires its copyright notice to
travel with "all copies or substantial portions of the Software", and the SIL Open
Font Licence requires its notice to accompany the font files themselves. Minified
bundles and `.woff2` files are copies, so the notices have to be reachable — this
is where they live.

Scope is deliberate: only what reaches a browser. Build-time dependencies (Astro,
Vite, Tailwind, the test tooling) are not redistributed as code and are not listed;
the full resolved tree is in `package-lock.json`.

---

## MIT

### React — `react` 19.2.8, `react-dom` 19.2.8, `scheduler` 0.27.0

Copyright (c) Meta Platforms, Inc. and affiliates.

<https://github.com/facebook/react>

### Nano Stores — `nanostores` 1.4.1

Copyright 2020 Andrey Sitnik <andrey@sitnik.es>

<https://github.com/nanostores/nanostores>

### Nano Stores React — `@nanostores/react` 1.1.0

Copyright 2020 Andrey Sitnik <andrey@sitnik.ru>

<https://github.com/nanostores/react>

### The MIT licence text, as required by the notices above

> Permission is hereby granted, free of charge, to any person obtaining a copy of
> this software and associated documentation files (the "Software"), to deal in the
> Software without restriction, including without limitation the rights to use,
> copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
> Software, and to permit persons to whom the Software is furnished to do so,
> subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
> FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
> AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
> WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Apache License 2.0

### Fuse.js — `fuse.js` 7.5.0

    Fuse.js v7.5.0 - Lightweight fuzzy-search (http://fusejs.io)

    Copyright (c) 2026 Kiro Risk (http://kiro.me)
    All Rights Reserved. Apache Software License 2.0

    http://www.apache.org/licenses/LICENSE-2.0

Fuse.js ships this notice as a banner comment in its own distribution, but the
minifier removes it: esbuild only preserves comments marked `/*!`, `@license` or
`@preserve`, and this one is a plain block comment. It cannot practically be kept
in the bundle, which is precisely why this file exists and why it is linked from
the site's credits page — the attribution has to be reachable somewhere, and if
not in the bundle then here.

Licensed under the Apache Licence, Version 2.0. You may obtain a copy at
<http://www.apache.org/licenses/LICENSE-2.0>. Unless required by applicable law or
agreed to in writing, software distributed under the Licence is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied.

---

## SIL Open Font License 1.1

### Nunito Sans — `@fontsource-variable/nunito-sans` 5.3.0

Copyright 2016 The Nunito Sans Project Authors
(<https://github.com/Fonthausen/NunitoSans>)

This Font Software is licensed under the SIL Open Font License, Version 1.1,
available at <https://openfontlicense.org>. The font is served as five `.woff2`
subsets from the site's own origin, so the OFL's notice requirement applies to
this site directly rather than only to the repository.

Under the OFL the font may be used, studied, modified and redistributed freely,
provided it is not sold by itself. The reserved font name may not be used to
promote modified versions.
