# Image Pager ⬡

Strip metadata, rename randomly, and zip your images.  
100% client-side — nothing leaves the browser.

## Features

- Drag & drop or click to upload (JPG, PNG, WebP, GIF, BMP, TIFF)
- Strips EXIF, XMP, IPTC, GPS, comments and all other metadata
- Randomly renames files with zero-padded numbers
- Downloads a clean `.zip` with processed images
- 3-layer stripping: canvas redraw → byte-level JPEG/PNG parsing → raw fallback

## Project structure

```
image-pager/
├── index.html
├── css/
│   ├── style.css        # source (readable)
│   └── style.min.css    # minified (served)
├── js/
│   ├── app.js           # source (readable)
│   └── app.min.js       # minified (served)
├── .gitignore
└── README.md
```

## Dev

Edit `css/style.css` and `js/app.js`, then re-minify:

```bash
npx clean-css-cli -o css/style.min.css css/style.css
npx terser js/app.js -o js/app.min.js -c -m
```

## License

MIT
