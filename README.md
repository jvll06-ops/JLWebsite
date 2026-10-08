# James Ledbetter: personal website and resume

This is the code behind your personal website and your one-page resume. Hamza
Deyaf and the Feniex Industries team built it for you as a thank-you for your
2026 Project Manager internship. It's yours now: change anything you like.

- **Your site today:** https://james-ledbetter.vercel.app/
- **Your resume:** https://james-ledbetter.vercel.app/resume/ (PDF: https://james-ledbetter.vercel.app/resume.pdf)

## What's in here

You only ever need two places:

- **`src/content/profile.json`**: every word on your site and your resume.
- **`src/assets/photos/`**: your photos.

The rest is the design (`src/components/`, `src/styles/`) and the machinery
that builds the site (`scripts/`). You can leave it alone. Two more things you
will see: `public/resume.pdf` and `public/og.jpg` are the latest printed resume
and the picture that shows up when someone shares your link. The build makes
them for you.

## 1. Download it

Pick one:

1. **No tools needed:** on this page on GitHub, click the green **Code** button,
   then **Download ZIP**, and unzip it.
2. **With git:** `git clone https://github.com/hdeyaf-sketch/james-ledbetter-site.git`

## 2. See it on your computer

1. Install **Node.js** from [nodejs.org](https://nodejs.org) (the **LTS**
   button; version 22 or newer).
2. Open a terminal in the project folder. Mac: right-click the folder in
   Finder, then **New Terminal at Folder**. Windows: open the folder, click the
   address bar, type `cmd` and press Enter.
3. Run `npm install` (once; it takes a minute or two and also downloads a
   small Chrome that prints your resume).
4. Run `npm run dev` and open **http://localhost:4321/** in your browser. Your
   resume is at **http://localhost:4321/resume/**.
5. Leave it running while you edit: the page refreshes every time you save.
   Press `Ctrl+C` in the terminal to stop.

## 3. Change the words

Open `src/content/profile.json` in any text editor (the free
[VS Code](https://code.visualstudio.com) is the easiest, and it warns you about
typos). It's plain text in a fixed shape: `"field": "value"`, with commas
between items. Keep the quotes and commas where they are and change only the
text inside the quotes. Type plain keyboard quotes and dashes; the site turns
them into proper typography.

A quick guide to the fields:

| Field | What it is |
| --- | --- |
| `name` | Your first, last and full name; `preferred` is what the site calls you ("About James") |
| `tagline`, `headline` | The big line at the top and the line under your name |
| `hometown`, `school` | Shown in your story and on the resume |
| `contact` | `email`, and optionally `linkedin`, `instagram`, `x`, `tiktok` (a link or a handle) and `website` |
| `bio` | `short` (up to 280 characters, used for previews) and `long` (the paragraphs of your story) |
| `stats` | Up to 4 big numbers near the top |
| `prs`, `timeline`, `honors` | Your track record: personal bests, career moments, awards |
| `inTheirWords`, `press` | Your own quotes from interviews, and articles about you |
| `strengths` | The four cards about what you bring to a team |
| `resume` | Everything on the one-page resume: `summary`, `experience`, `education`, `athletics`, `leadership`, `skills`, `honors` |
| `hamzaQuote` | Hamza's reference for you. Please ask him before changing his words |
| `images`, `photoCredits` | Which photo goes where, and who took them (see step 4) |
| `site.url` | Your site's web address (see step 6) |
| `seo` | The title and description Google and link previews show |
| `noindex` | `true` keeps your site out of Google (see step 7) |

Two rules the checks enforce: **no phone numbers anywhere** (the site never
publishes them), and at most 4 `stats`. To remove something, delete the whole
line or block, and its comma. Run `npm run check:data` any time to check your
edits; it points at the exact field that's wrong.

## 4. Swap a photo

1. Put the new photo (JPEG) in `src/assets/photos/`.
2. In `profile.json`, under `images`, write its file name where the old one was.

Your photos now:

- `pro.jpg`: the studio portrait at the top of the page, on the resume and in link previews (`images.hero`)
- `athlete.jpg`: the portrait in uniform beside your story (`images.portrait`)

Tips: portraits look best at 3:4 (portrait shape), action photos at 3:2 and at
least 1600 pixels wide. `images.resumeCrop` frames your face in the round
resume photo (`x` and `y` from 0 to 1 pick the center, `zoom` from 1 to 2 goes
closer). If you add an action photo, add a short description of it to
`actionAlt` in the same order (screen readers read it aloud).

## 5. Rebuild the resume PDF

The PDF is printed from the same words as the `/resume/` page.

1. Run `npm run build`. It builds the finished site into `dist/`, prints
   `resume.pdf` on exactly one page, and saves a copy in `public/`.
2. If the resume no longer fits on one page, the build stops and says so.
   Shorten a bullet or two in `resume` and run it again.
3. Run `npm run check` before you publish: it checks the words, builds
   everything and confirms the PDF is one page with your name on it.
4. `npm run preview` shows the finished build at http://127.0.0.1:4400/.

**Always rebuild on your computer after you change your resume, then save
(commit) `public/resume.pdf`, `public/og.jpg` and `scripts/last-render.json`
along with your edits.** Vercel's build machines can't print PDFs, so your live
site uses the copy saved in `public/`.

## 6. Put it online with your own free Vercel account

1. **Get your own copy on GitHub.** Vercel publishes a repository from your own
   GitHub account. (If Hamza has already moved this repository into your
   account, skip to 2.) Easiest: on GitHub click **+ > New repository**, name
   it `james-ledbetter-site`, choose **Private**, create it, then click **uploading an
   existing file** and drag in everything from the unzipped folder. With git:
   create the empty repository, then in your project folder run
   `git remote set-url origin https://github.com/<your-username>/james-ledbetter-site.git`
   and `git push -u origin main`.
2. Go to [vercel.com](https://vercel.com) and sign up with **Continue with
   GitHub** (the free Hobby plan is all you need).
3. Click **Add New... > Project** and **Import** your `james-ledbetter-site`
   repository. (If it isn't listed, click **Adjust GitHub App Permissions** and
   give Vercel access to it.)
4. Check the settings: **Framework Preset: Astro**, **Build Command:
   `npm run build`**, **Output Directory: `dist`**. Click **Deploy**.
5. In a minute Vercel shows your new address (something like
   `https://james-ledbetter-site.vercel.app`). Put it in `site.url` in
   `profile.json`, run `npm run build`, and commit and push. From now on,
   every push to GitHub updates your site automatically.
6. Your current address, https://james-ledbetter.vercel.app, stays on Hamza's Vercel account and keeps
   working until you're set up. Send Hamza your new address when it's live.

Want your own domain (like `yourname.com`)? Buy one and add it under your
Vercel project's **Settings > Domains**, then put it in `site.url`.

## 7. Let Google find your site

Your site starts hidden from search engines, so you can get it right first.
When you're happy with it:

1. In `profile.json`, change `"noindex": true` to `"noindex": false`.
2. Run `npm run build`, then commit and push.

That removes the "don't index" tag from every page and adds a sitemap. Google
usually picks a site up within a few days to a few weeks. To speed it up, add
your address in [Google Search Console](https://search.google.com/search-console).

## Photo credits

- Portraits: AI-assisted edits of official Texas Athletics headshots

The studio portraits are **AI-assisted edits of your official Texas Athletics
headshots**, and the site labels them that way. If you'd rather use a real
photo, swap it in (step 4). Keep the credits with any photo you reuse
elsewhere.

## If you get stuck

Copy the error message from the terminal and ask a friend who codes, or paste
it into an AI assistant like Claude together with the step you were on. Most
problems are a missing comma or quote in `profile.json`, which
`npm run check:data` will point to.

Fonts: Archivo and Newsreader, both under the SIL Open Font License.
