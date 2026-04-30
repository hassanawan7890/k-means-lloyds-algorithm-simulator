# KMeans Simulator

Interactive web app for visualizing k-means clustering and the Lloyd-Forgy update process in real time.

Live demo: https://k-means-lloyds-algorithm-simulator.vercel.app

## Overview

This project turns a C++ k-means assignment into a polished browser-based simulator. It lets users build datasets, watch centroid movement frame by frame, and explore how clustering changes across iterations.

The app is designed for:

- learning how k-means works
- demonstrating Lloyd's algorithm visually
- testing different centroid placements and dataset shapes
- sharing the simulator online without requiring a local build

## Features

- manual entry of point and centroid coordinates
- click-to-place editing directly on the canvas
- import support for the original A4 text input format
- random dataset generation with seed-based reproducibility
- adjustable animation delay and centroid interpolation frames
- epsilon-based stopping or max-iteration stopping
- mobile-friendly simulator workspace with touch canvas support
- guide and theory pages built into the app
- feedback page that opens an email draft to `hassanawan789@outlook.com`

## How It Works

For each iteration, the simulator:

1. assigns every point to its nearest centroid
2. recomputes each centroid as the mean of its assigned points
3. animates the centroid movement
4. repeats until convergence or until the maximum iteration limit is reached

The visualization also shows:

- current iteration number
- current phase of the algorithm
- centroid shift value
- Voronoi-style background ownership regions

## Input Modes

- `Manual`: type one `x y` coordinate pair per line
- `Canvas`: click to add points, add centroids, or erase the nearest item
- `Import`: paste or upload the original assignment dataset format
- `Generate`: create a random scene using profile, spread, noise, world size, and seed controls

## Local Development

From the repository root:

```powershell
cd C:\Users\Hassan\Downloads\A4\kmeans-app
python -m http.server 4173 --bind 127.0.0.1
```

Then open:

`http://127.0.0.1:4173/`

## Project Structure

The deployable app lives in [kmeans-app](./kmeans-app).

- [kmeans-app/index.html](./kmeans-app/index.html) - UI structure and content pages
- [kmeans-app/styles.css](./kmeans-app/styles.css) - styling, layout, and responsive behavior
- [kmeans-app/app.js](./kmeans-app/app.js) - simulator logic, animation, parsing, and interaction
- [kmeans-app/input.txt](./kmeans-app/input.txt) - sample dataset
- [kmeans-app/vercel.json](./kmeans-app/vercel.json) - Vercel configuration

## Deployment

This repository is connected to Vercel.

- production site: `https://k-means-lloyds-algorithm-simulator.vercel.app`
- GitHub repository: `https://github.com/hassanawan7890/k-means-lloyds-algorithm-simulator`
- Vercel project root: `kmeans-app`
- production branch: `main`

Any new push to `main` should trigger a new Vercel deployment automatically.

## Feedback

Questions, bug reports, and suggestions:

`hassanawan789@outlook.com`
