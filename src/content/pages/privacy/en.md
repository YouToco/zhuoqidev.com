---
title: Privacy Policy
description: Privacy Policy for ZhuoQi Dev
date: 2026-10-07
---

## The short version

There is no sign-up or login, and I do not collect identifying information such as your name or email address. There is a [guestbook](/en/guestbook/): signing is optional, and a note is published only after I have read it. To learn whether articles are read and where readers come from, the site uses **three third-party analytics services** (Google Analytics, Baidu Tongji, and Cloudflare Web Analytics) plus **its own count** (only the date and an approximate location; no IP address is stored and no cookies are used). This page explains what each records and stores.

## Analytics

The three analytics scripts load only on the production domain `zhuoqidev.com`, never on local previews or test builds. They record common visit data: the page URL (including the `?q=` search term when you use site search), the referring page, browser and device type, screen size, approximate location (city level), and the time of the visit.

| Service | Purpose | Cookies | Privacy policy |
| --- | --- | --- | --- |
| Google Analytics 4 | Visit statistics for readers outside China | Yes: `_ga`, `_ga_*`, to tell new and returning visitors apart | [Google Privacy Policy](https://policies.google.com/privacy) |
| Baidu Tongji | Visit statistics for readers in mainland China | Yes: `Hm_lvt_*`, `Hm_lpvt_*` and similar, to tell new and returning visitors apart | [Baidu privacy statement](https://www.baidu.com/duty/yinsiquan.html) |
| Cloudflare Web Analytics | Page performance and traffic | No cookies and no local storage | [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/) |

The providers collect and store this data. I only look at aggregate reports in their dashboards (such as views per article and traffic sources). I do not link the data to individual people, and I do not sell or hand it to anyone.

**Opting out**: use a content or tracker blocker (such as uBlock Origin) to block these scripts; everything on the site keeps working. Google also offers the [Google Analytics Opt-out Browser Add-on](https://tools.google.com/dlpage/gaoptout). Note that `_ga` and `Hm_*` are cookies set on this site's own domain, so blocking only third-party cookies does not stop them.

## The site's own count

Besides the three services above, the site counts two things itself. The numbers live in a Cloudflare database (D1), and only I see the totals:

- **Page views by people**: each page you open sends one empty request to `api.zhuoqidev.com` (no cookie, and not even which page it was). The server records only the date and the country, region, and city that Cloudflare derives from your IP address at that moment. **The IP address itself is not stored.** To count how many different visitors came that day, the server hashes the IP address and browser identifier (User-Agent) together with a salt that is generated at random each day; the next day the salt and the hashes are deleted, after which nobody can turn a hash back into an IP address.
- **Crawler visits**: the User-Agent of a request tells which company's crawler it is (such as Googlebot, Baidu, or ClaudeBot), and only "which crawler came how many times" is kept per day. Outside mainland China the Cloudflare server counts live; for mainland China the site reads the Alibaba Cloud CDN access log once a day and keeps only these counts.

If the third-party scripts are blocked, the site's own count still works; if this empty request is blocked, nothing on the site breaks.

## Guestbook

When you pin a note on the [guestbook](/en/guestbook/), the server stores:

- the text, the name you signed with (optional), the note colour, the language of the page, and the time;
- the country, region, and city that Cloudflare derives from your IP address, **shown only to me while reviewing**, never published;
- a hash of your IP address valid for that day (with the same daily salt that is deleted the next day), used only to stop one person from posting many notes in a row.

A note is published only after I have read it, and only the name, text, and date are shown. To have your note deleted, contact me as below. Notes of yours that are still waiting for review keep a copy in your browser (localStorage, key `zq-guestbook-mine`) so you can see them; it is cleared once they are approved.

## Data that stays in your browser

- **Dark / light mode**: if you switch it manually, your choice is saved in the browser's localStorage (key `zq-theme`). It stays on your device and is never sent to a server.
- **Site search**: the search index is downloaded from this site and matching runs in your browser; there is no search server.
- **Your notes awaiting review**: see "Guestbook" above (key `zq-guestbook-mine`).

## Hosting & CDN

The site is hosted and accelerated via:

- **Cloudflare Pages** (readers outside mainland China): may log access for security purposes; Cloudflare may set a necessary security cookie (such as `__cf_bm`)
- **Alibaba Cloud OSS + CDN** (readers in mainland China): may log access

These logs are generated by the platforms. The site does one thing with them: once a day it reads the Alibaba Cloud CDN log to count visits by each crawler (see "The site's own count") and keeps nothing else. Fonts, images, and scripts are served from this site's own domain (analytics excepted), not from third-party font or image CDNs.

## External links

Articles link to external websites (such as GitHub, arXiv, and vendor documentation). Those sites have their own privacy policies.

## Contact

For privacy-related inquiries:

- GitHub: [@YouToco](https://github.com/YouToco)
- Email: See GitHub profile

## Policy updates

This policy is updated when the site changes, and the latest version is always posted here. Last updated: 2026-10-07 (adds the guestbook and the site's own count; an earlier version said no third-party analytics were enabled, which was inaccurate and has been corrected).
