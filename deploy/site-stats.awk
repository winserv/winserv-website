# site-stats.awk — aggregates for the Winserv site from nginx `combined` lines
# (spec 2026-10-08 §7). Runs on the VM; prints counts only — no address, no user agent,
# no raw line ever leaves the EU. POSIX awk: mawk on the VM, BSD awk on the Mac.
BEGIN { FS = "\"" }
NF < 6 { next }                                     # nginx error lines and notices
{
    lines++
    ua = tolower($6)
    # The container's own healthcheck is ~2,880 lines a day (measured 2026-10-08).
    if (ua ~ /wget|bot|crawl|spider|slurp|curl|python|monitor|headless|preview/) { bots++; next }
    split($2, req, " "); method = req[1]; path = req[2]
    split($3, sb, " "); status = sb[1]
    if (path ~ /^\/e\/contato-email/) {             # the beacon is a POST
        slug = "(sem p)"
        q = path; sub(/^[^?]*\??/, "", q)
        n = split(q, kv, "&")
        for (i = 1; i <= n; i++) if (kv[i] ~ /^p=/) slug = substr(kv[i], 3)
        clicks[slug]++
        next
    }
    if (method != "GET" && method != "HEAD") next
    if (status != "200" && status != "304") next    # no-cache: a returning reader is a 304
    sub(/\?.*/, "", path)
    if (path ~ /\.(css|js|svg|webp|jpg|png|woff2|ico|xml|txt|json)$/) next
    views++; page[path]++
    ref = $4
    if (ref == "-" || ref == "") host = "(sem origem)"
    else {
        host = ref; sub(/^[a-zA-Z]+:\/\//, "", host); sub(/\/.*/, "", host)
        if (host == "www.winserv.com.br") host = "(interno)"
    }
    origin[host]++
}
END {
    if (lines == 0) { print "nenhuma linha do winserv-site no periodo — journal inacessivel ou container parado?"; exit 2 }
    printf "linhas %d, robos/healthcheck %d, visualizacoes %d\n", lines, bots, views
    if (views > 0) printf "sem origem: %d%%\n", int(100 * origin["(sem origem)"] / views)
    print "-- paginas"; for (k in page) printf "%6d %s\n", page[k], k
    print "-- origem"; for (k in origin) printf "%6d %s\n", origin[k], k
    print "-- cliques no e-mail, por pagina"; for (k in clicks) printf "%6d %s\n", clicks[k], k
}
