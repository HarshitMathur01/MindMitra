# art-source

Camera-original art that is **processed into `src/assets/` at author time, not
served**. Nothing in here is referenced by the app or copied into `dist/`.

It lives outside `public/` deliberately: anything under `public/` is deployed
verbatim, and these are multi-megapixel originals. `mindgym-forest/` alone is
40.7 MB of 8000px JPEG that was shipping to every visitor's browser cache
budget for no reason — the app now uses the ~150 KB derivatives in
`src/assets/mindgym/forest/`.

| Directory | Consumer | Regenerate with |
|---|---|---|
| `mindgym-forest/` | `src/components/mindgym/ForestBackdrop.tsx` | `npm run optimize:forest` |
| `chat/` | `src/components/chat/ChatMessageList.tsx` | see below |

`chat/companion-avatar-1024.png` is the source for the 128px avatar in
`src/assets/chat/`. It has no script — it is one image, resized once:

```
npx sharp -i art-source/chat/companion-avatar-1024.png           -o src/assets/chat/companion-avatar-128.webp resize 128
```

Assets imported from `src/` are content-hashed by Vite at build time, so
unlike `public/` these filenames do not need a hash of their own.

Re-run the script after changing any source file; outputs are content-hashed,
so a changed image must produce a changed filename or caches will not see it.
