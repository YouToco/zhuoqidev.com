---
title: Privacy Policy
description: Privacy Policy for ZhuoQi Dev
date: 2026-10-08
---

## The short version

There is no sign-up or login, and I do not collect identifying information such as your name or email address. There is a [guestbook](/en/guestbook/): signing is optional, and a note is published only after I have read it. To learn whether articles are read and where readers come from, the site uses **three third-party analytics services** (Google Analytics, Baidu Tongji, and Cloudflare Web Analytics) plus **its own count** (only the date, an approximate location and which article was opened; no IP address is stored and no cookies are used). This page explains what each records and stores.

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

Besides the three services above, the site counts two things itself. The numbers live in a Cloudflare database (D1). Totals by country, province and crawler are public on the [visitor map](/en/visitors/); the city-level breakdown is for my eyes only; the numbers per article are not published and only set the order of "popular lately":

- **Page views by people**: each page you open sends one request (no cookie), used to count views by place and how many people opened each article. **The IP address itself is not stored.** The two hosting lines do this differently:
  - Overseas line (Cloudflare): the request goes to `api.zhuoqidev.com` and carries the path of the page. The server records only three things: the date; the country, region, and city that Cloudflare derives from your IP address at that moment; and, when the page is an article, which article (only its name, such as `verify-llm-relay-api`, not the full address; the Chinese and English editions count as the same article). To count how many different visitors came that day, and to each article, the server hashes the IP address and browser identifier (User-Agent) together with a salt that is generated at random each day; the next day the salt and the hashes are deleted, after which nobody can turn a hash back into an IP address.
  - Mainland line (Alibaba Cloud CDN): the page fetches a 1-pixel image, `/hit.gif`, from this site's own domain, and that request lands in the Alibaba Cloud CDN access log like any other, with the page you are reading as its referring page (Referer). Once a day the previous day's log is read, each IP address is looked up offline in the open-source ip2region database to get a country, region, and city, and visitors are counted as "same IP address plus same browser identifier", provided that address and browser also fetched the page or one of its files that day (a request for the image alone, with nothing else, is almost always an automated program and is not counted); only the number of views and visitors per place and per article (again only the article's name) is stored. The program that reads the log runs on GitHub Actions and is discarded afterwards; the IP addresses never leave it.
- **Crawler visits**: the User-Agent of a request tells which company's crawler it is (such as Googlebot, Baidu, or ClaudeBot), and only "which crawler came how many times" is kept per day. Outside mainland China the Cloudflare server counts live; for mainland China the site reads the Alibaba Cloud CDN access log once a day and keeps only these counts.

If the third-party scripts are blocked, the site's own count still works; if this request (or the 1-pixel image) is blocked, nothing on the site breaks.

**What the counts per article are for**: "Popular lately", at the top of the article list and at the end of each article, lists the articles with the most visitors over the last 30 days (both hosting lines together). The pages show only the order, never the number of readers; the ranking is public at `/hot.json`, which likewise holds only the article names in order.

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

These logs are generated by the platforms. The site does one thing with them: once a day it reads the Alibaba Cloud CDN log to count visits by each crawler, page views by people in each place and views of each article (see "The site's own count") and keeps nothing else. Fonts, images, and scripts are served from this site's own domain (analytics excepted), not from third-party font or image CDNs.

## External links

Articles link to external websites (such as GitHub, arXiv, and vendor documentation). Those sites have their own privacy policies.

## Contact

For privacy-related inquiries:

- GitHub: [@YouToco](https://github.com/YouToco)
- Email: See GitHub profile

## Policy updates

This policy is updated when the site changes, and the latest version is always posted here. Last updated: 2026-10-31 (the site's own count now records views and visitors per article, by the article's name only, to rank "popular lately"). The 2026-10-18 version stopped counting a request for `/hit.gif` with no request for the page as a person on the mainland line. The 2026-10-13 version started counting page views by people on the mainland line from the Alibaba Cloud CDN log. The 2026-10-08 version made the site's own counts, totalled by country, province and crawler, public on the visitor map; the 2026-10-07 version added the guestbook and the site's own count; an earlier version said no third-party analytics were enabled, which was inaccurate and has been corrected.
