# Deploying to Vercel

None of these steps has been run yet. No deployment, DNS change or Git commit has been made.

## Vercel project settings

`vercel.json` already contains these settings. Enter them in the dashboard as well if you are asked.

| Setting | Value |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | the folder containing `package.json` (`Pathirana-Hardware-ComingSoon` if imported from the monorepo) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | 20.x or newer (the default, 24.x, is fine) |
| Environment Variables | none |

`vercel.json` also sets:
- Long-term caching for the fingerprinted files in `/assets/`, and one-week caching for `/img/`.
- Security headers: Content-Security-Policy (self-hosted only), nosniff, frame-deny, Referrer-Policy and Permissions-Policy.

## Option A: Vercel CLI (no Git required)

```bash
npm i -g vercel
cd "D:\Pathirana Hardware\Pathirana-Hardware-ComingSoon"
vercel login
vercel            # creates a NEW project, e.g. "pathirana-hardware-comingsoon", and gives a preview URL
vercel --prod     # promotes to production once the preview looks right
```

## Option B: Git import (after you decide on version control)

1. Put this folder in its own repository, or in the monorepo. Nothing has been committed yet; that decision is yours.
2. In Vercel, go to **Add New → Project → Import** and select the repository.
3. If it's in the monorepo, set **Root Directory** to `Pathirana-Hardware-ComingSoon`.
4. Check the settings in the table above and click **Deploy**.

## Connecting pathiranahardware.lk

1. In Vercel, open the project and go to **Settings → Domains**. Add `pathiranahardware.lk`, then add `www.pathiranahardware.lk` set to redirect to the apex domain.
2. Vercel shows the DNS records to create. They are typically an `A` record for `@` → `76.76.21.21` and a `CNAME` record for `www` → `cname.vercel-dns.com`. **Use exactly the values Vercel displays for your project.**
3. At the `.lk` DNS provider, change only the website records (`@` and `www`). **Do not touch MX or TXT records**, or email may break.
4. Wait for **Valid Configuration**. HTTPS is issued automatically; DNS propagation can take up to 24–48 hours.

## When the full Customer Website is ready

Move the domain from this project to the Customer Website's Vercel project, then pause or delete this project. Nothing else depends on it.

## Post-deploy checklist

- [ ] The 3D scene animates on a desktop browser and on an Android phone
- [ ] **WhatsApp Us** opens a chat with +94 71 225 9699
- [ ] **Call Us**, **Contact Us** and the phone number open the dialler
- [ ] The favicon and the share preview (WhatsApp/Facebook) show the logo
- [ ] https://pathiranahardware.lk loads with a valid certificate
