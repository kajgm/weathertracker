# Homelab deployment (Kubernetes + Cloudflare Tunnel)

This repo builds and publishes the image. **The Kubernetes manifests live in `kajgm/homelab`** at
`k8s/apps/weathertracker/` (ArgoCD), next to every other app. Deploying a new version is a
one-line tag bump there — nothing is copied between repos.

```
Pi (Chromium kiosk) ─https─▶ Cloudflare edge (Access) ─tunnel─▶ cloudflared ─┐
LAN browser ─https─▶ lab-gateway 10.10.0.205 (weather.lab.kajgm.com) ────────┴─▶ svc weathertracker:80 ─▶ pod :8080 (nginx, static files)
browser ─▶ api.open-meteo.com / api.iconify.design   (called by the browser, not the pod)
```

| Item | Value |
|---|---|
| Image | `ghcr.io/kajgm/weathertracker:<X.Y.Z>` (amd64 + arm64), built by `.github/workflows/image.yml` |
| Manifests | `kajgm/homelab` → `k8s/apps/weathertracker/{application.yaml,manifests/}` |
| Deployed version | `images[0].newTag` in `k8s/apps/weathertracker/manifests/kustomization.yaml` |
| Public | `https://weather.kajgm.com` (tunnel; Access with home-IP Bypass for the kiosk) |
| Internal | `https://weather.lab.kajgm.com` (HTTPRoute on `lab-gateway`, LE wildcard) |

## Who owns what

| Change | Repo |
|---|---|
| App code, Dockerfile, nginx config | `kajgm/weathertracker` |
| Deployment, Service, HTTPRoute, NetworkPolicies, image tag | `kajgm/homelab` `k8s/apps/weathertracker/` |
| Tunnel hostname, cloudflared egress | `kajgm/homelab` `k8s/infra/cloudflared/` |

The container listens on **8080**. If that ever changes, update the Deployment, the app's
NetworkPolicies **and** the cloudflared egress rule in the same homelab commit.

## Release a new version

1. Merge to `main` here, then tag it (workstation):

   ```sh
   git switch main && git pull
   git tag v1.0.1 && git push origin v1.0.1
   ```

2. When the Actions run is green, bump `newTag: 1.0.1` in `k8s/apps/weathertracker/manifests/kustomization.yaml` in `kajgm/homelab`, commit, push, then:

   ```sh
   argocd app sync weathertracker --core --kube-context argocd-core
   ```

3. The kiosk loads the new bundle on its next page load (`index.html` is served `no-cache`). Reboot the Pi or rerun `startup.sh` to force it.

## First-time setup

### 1. Image (workstation)

Merge to `main`, tag `v1.0.0` as above. The package must be **public** so the cluster pulls without a
pull secret. If this doesn't print `200`, GitHub → Packages → weathertracker → Package settings → Change visibility:

```sh
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:kajgm/weathertracker:pull" | jq -r .token)
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.index.v1+json" \
  https://ghcr.io/v2/kajgm/weathertracker/manifests/1.0.0
```

### 2. Cloudflare Access (dashboard), before the DNS route

Zero Trust → Access → Applications → Add → Self-hosted, domain `weather.kajgm.com`, session 1 month.

| Policy | Action | Include |
|---|---|---|
| `home-kiosk` (order 1) | **Bypass** | IP ranges: `$HOME_IP/32` |
| `owner` (order 2) | Allow | Emails: owner (+ group `friends` if wanted) |

Get the home public IP from the Pi: `curl -s https://1.1.1.1/cdn-cgi/trace | grep '^ip='`.
If Rogers changes it, the kiosk shows a Cloudflare login page; update the policy.

### 3. DNS

On `client`:

```sh
cloudflared tunnel route dns homelab weather.kajgm.com
dig @1.1.1.1 +short weather.kajgm.com
```

Internal record (wherever you run the MAAS CLI):

```sh
maas admin dnsresources create fqdn=weather.lab.kajgm.com ip_addresses=10.10.0.205
dig +short weather.lab.kajgm.com
```

### 4. Homelab repo

Merge the homelab PR that adds `k8s/apps/weathertracker/` and the cloudflared rule, then:

```sh
argocd app sync homelab --core --kube-context argocd-core
argocd app sync weathertracker --core --kube-context argocd-core
argocd app sync cloudflared --core --kube-context argocd-core
```

Verify:

```sh
kubectl -n weathertracker get pods,svc,httproute
curl -sI https://weather.lab.kajgm.com | head -1   # LAN: 200
curl -sI https://weather.kajgm.com | head -5       # off-LAN: 302 to <team>.cloudflareaccess.com; from the Pi: 200
```

A 502 page on the public URL means cloudflared can't reach the pod. Check what's being dropped:
`kubectl -n kube-system exec ds/cilium -- hubble observe -n weathertracker --verdict DROPPED`.

### 5. Raspberry Pi kiosk

The Pi only needs Chromium. Remove the old local container if it exists, then update and start:

```sh
docker rm -f weathertracker 2>/dev/null || true
cd ~/weathertracker && git pull && chmod +x startup.sh && ./startup.sh
```

`startup.sh` opens `https://weather.kajgm.com/` by default. If the Pi resolves `lab.kajgm.com` (it
uses OPNsense/MAAS DNS), `WEATHERTRACKER_URL=https://weather.lab.kajgm.com/` keeps the kiosk off
the internet path entirely.
