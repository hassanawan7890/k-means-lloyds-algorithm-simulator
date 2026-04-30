# K-Means Motion Lab

Static web app version of the `A4.cpp` k-means visualizer.

## What it does

- keeps the white-canvas, black-outline, seeded-color style from the C++ version
- lets the user add data in four ways:
  - type points and centroids manually
  - click directly on the canvas
  - upload or paste the original A4 input format
  - generate a fresh dataset from point and centroid counts
- animates centroid movement and shows the current iteration number
- supports either epsilon stopping or max-iteration stopping

## Local use

From the repo root, serve the `kmeans-app` folder with any static server:

```powershell
cd C:\Users\Hassan\Downloads\A4\kmeans-app
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Using your existing generator

`generate_input.cpp` still works as a dataset generator for the web app workflow:

1. compile and run it locally to produce a `.txt` file in A4 format
2. open the web app
3. go to the `Import` tab
4. upload that generated file or paste its contents

## Git + GitHub + Vercel

This project is already set up to be deployed as a static Vercel site.

### Local git repo

If you want to create the repo from the A4 root manually:

```powershell
cd C:\Users\Hassan\Downloads\A4
git init
git branch -M main
git add .
git commit -m "Initial k-means web app"
```

### Push to GitHub

If you already created an empty GitHub repo:

```powershell
git remote add origin <your-repo-url>
git push -u origin main
```

### Connect to Vercel

1. Sign in to Vercel.
2. Click `Add New...` -> `Project`.
3. Import the GitHub repo.
4. Set the project `Root Directory` to `kmeans-app`.
5. Keep the default static deployment settings.
6. Deploy.

No build command is required for this version.
