# Merchize Storefront Performance Baseline

Baseline captured before the snapshot-first product detail resolver was implemented.

Date: 2026-06-03
URL: https://codexchristi.shop/product/68cf0a371581a3c735032ca4

## Header / TTL Signals

Command:

```sh
curl -I -L https://codexchristi.shop/product/68cf0a371581a3c735032ca4
```

Observed headers:

```txt
HTTP/2 200
content-type: text/html; charset=utf-8
server: cloudflare
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-powered-by: Next.js
x-request-time: 0.029
x-cache-status: MISS
cf-cache-status: DYNAMIC
cf-ray: a05d13ff2fd9f434-LAX
```

Interpretation:

- Browser/CDN HTML TTL is effectively zero because `Cache-Control` is `no-store`.
- Cloudflare did not cache the HTML document: `cf-cache-status: DYNAMIC`.
- App/server request time reported by the deployment was `0.029s`.

## Single Document Timing

Command:

```sh
curl -L -o /dev/null -s -w '{"http_code":%{http_code},"time_namelookup":%{time_namelookup},"time_connect":%{time_connect},"time_appconnect":%{time_appconnect},"time_starttransfer":%{time_starttransfer},"time_total":%{time_total},"size_download":%{size_download},"speed_download":%{speed_download}}\n' https://codexchristi.shop/product/68cf0a371581a3c735032ca4
```

Result:

```json
{
  "http_code": 200,
  "time_namelookup": 0.002522,
  "time_connect": 0.017278,
  "time_appconnect": 0.066033,
  "time_starttransfer": 0.674673,
  "time_total": 0.701853,
  "size_download": 127374,
  "speed_download": 181482
}
```

## Autocannon Baseline

Command:

```sh
autocannon -d 15 -c 5 --renderStatusCodes https://codexchristi.shop/product/68cf0a371581a3c735032ca4
```

Result:

```txt
15s, 5 connections

Latency:
2.5% 68 ms
50% 88 ms
97.5% 2351 ms
99% 3105 ms
Avg 312.15 ms
Stdev 693.65 ms
Max 6351 ms

Req/Sec:
1% 7
2.5% 7
50% 15
97.5% 22
Avg 14.87
Stdev 4.58
Min 7

Bytes/Sec:
1% 905 kB
2.5% 905 kB
50% 1.94 MB
97.5% 2.84 MB
Avg 1.92 MB
Stdev 591 kB
Min 905 kB

Status codes:
200: 223

Total:
228 requests in 15.04s
28.8 MB read
```

## Follow-Up

Do not run the post-change production comparison until the storefront snapshot workflow is deployed
and the user explicitly asks for the comparison run.
