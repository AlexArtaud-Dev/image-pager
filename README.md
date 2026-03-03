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
├── nginx.conf           # nginx site config template
├── .gitignore
└── README.md
```

## Deploy with nginx

1. Clone the repo to your server:
   ```bash
   git clone https://github.com/YOUR_USER/image-pager.git /var/www/image-pager
   ```

2. Copy and edit the nginx config:
   ```bash
   sudo cp /var/www/image-pager/nginx.conf /etc/nginx/sites-available/image-pager
   sudo ln -s /etc/nginx/sites-available/image-pager /etc/nginx/sites-enabled/
   ```

3. Edit `server_name` and SSL paths in the config.

4. Test & reload:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Dev

Edit `css/style.css` and `js/app.js`, then re-minify:

```bash
npx clean-css-cli -o css/style.min.css css/style.css
npx terser js/app.js -o js/app.min.js -c -m
```

## License

MIT
