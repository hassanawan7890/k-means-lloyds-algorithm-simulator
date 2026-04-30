# K-Means & Lloyd's Algorithm Simulator

Interactive static web app for exploring k-means clustering and the Lloyd-Forgy algorithm in the browser.

## Highlights

- build datasets manually, by canvas clicks, by A4-format import, or by random generation
- animate point reassignment and centroid motion iteration by iteration
- experiment with epsilon stopping, max iterations, animation delay, and interpolation frames
- read built-in guide and theory pages for coursework or demos
- send feedback directly to `hassanawan789@outlook.com`

## Project Structure

The publishable app lives in [kmeans-app](./kmeans-app).

- [kmeans-app/index.html](./kmeans-app/index.html)
- [kmeans-app/styles.css](./kmeans-app/styles.css)
- [kmeans-app/app.js](./kmeans-app/app.js)
- [kmeans-app/vercel.json](./kmeans-app/vercel.json)

## Local Preview

```powershell
cd C:\Users\Hassan\Downloads\A4\kmeans-app
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Deploying To Vercel

Deploy the `kmeans-app` directory as the project root.

- Framework preset: `Other`
- Root directory: `kmeans-app`
- Build command: none
- Output directory: none

## Feedback

Questions, bug reports, and suggestions can be sent to `hassanawan789@outlook.com`.
