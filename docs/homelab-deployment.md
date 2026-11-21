# Homelab deployment (Kubernetes + Cloudflare Tunnel)

Runs the app on the kubeadm cluster, managed by ArgoCD from `kajgm/homelab`, published at
`https://weather.kajgm.com` through the existing `homelab` Cloudflare Tunnel. The Raspberry Pi
becomes a plain kiosk that opens that URL — it no longer runs Docker.

```
Pi (Chromium kiosk) ──https──▶ Cloudflare edge (Access) ──tunnel──▶ cloudflared ──▶ svc weathertracker:80 ──▶ pod :8080 (nginx, static files)
browser ──▶ api.open-meteo.com / api.iconify.design   (called by the browser, not the pod)
```

| Item | Value |
|---|---|
| Image | `ghcr.io/kajgm/weathertracker:<X.Y.Z>` (amd64 + arm64), built by `.github/workflows/image.yml` |
| Namespace / Service | `weathertracker` / `weathertracker:80` → pod `http`=8080 |
| Pod | nginx-unprivileged uid 101, read-only root, emptyDir `/tmp`, no SA token, default-deny netpol |
| Public host | `weather.kajgm.com` (tunnel only, no internal HTTPRoute) |
| Access | Allow: owner (+ `friends` if wanted); **Bypass: home public IP** so the kiosk never sees a login |
| Homelab repo path | `k8s/apps/weathertracker/{application.yaml,manifests/}` (copied from `deploy/k8s/weathertracker/` here) |

## 1. Publish the image (workstation)

Merging to `main` pushes `:main` and `:sha-<short>`. Cut a release tag for the version the cluster pins:

```sh
git switch main && git pull
git tag v1.0.0 && git push origin v1.0.0
```

Verify (Actions run green, then):

```sh
docker manifest inspect ghcr.io/kajgm/weathertracker:1.0.0 | grep architecture
```

The package must be **public** so the cluster can pull without a pull secret. If the anonymous
check below doesn't print `200`, set it public: GitHub → Packages → weathertracker → Package settings → Change visibility.

```sh
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:kajgm/weathertracker:pull" | jq -r .token)
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.index.v1+json" \
  https://ghcr.io/v2/kajgm/weathertracker/manifests/1.0.0
```

## 2. Add the app to the homelab repo (workstation, `~/kajdev/homelab`)

```sh
mkdir -p k8s/apps/weathertracker
cp -r ~/kajdev/weathertracker/deploy/k8s/weathertracker/. k8s/apps/weathertracker/
```

1. Diff `k8s/apps/weathertracker/application.yaml` against an existing app (e.g. `k8s/apps/convertx/application.yaml`) and match its `project`, finalizers and sync options.
2. Add `- weathertracker/application.yaml` to `k8s/apps/kustomization.yaml`.
3. Confirm `newTag` in `manifests/kustomization.yaml` matches the tag from step 1.

Validate:

```sh
kubectl kustomize k8s/apps/weathertracker/manifests | kubectl apply --dry-run=server -f -
kubectl kustomize k8s/apps | yq 'select(.kind=="Application") | .metadata.name + " -> " + .spec.source.path'
grep -rl 'kind: Application$' k8s/apps/*/manifests/   # must print nothing
```

## 3. Cloudflare Access (dashboard) — before the DNS route

Zero Trust → Access → Applications → Add → Self-hosted, domain `weather.kajgm.com`, session 1 month.

| Policy | Action | Include |
|---|---|---|
| `home-kiosk` (order 1) | **Bypass** | IP ranges: `$HOME_IP/32` |
| `owner` (order 2) | Allow | Emails: owner (+ group `friends` if wanted) |

Get the home public IP **from the Pi** (or any LAN host):

```sh
curl -s https://1.1.1.1/cdn-cgi/trace | grep '^ip='
```

> Rogers can change the home IP. If the kiosk ever shows a Cloudflare login page, update this policy.
> Because bypassed requests carry no Access JWT, the cloudflared rule below must **not** set
> `originRequest.access.required` — Access is enforced at the edge either way.

## 4. Tunnel route + cloudflared config (homelab repo, then `client`)

On `client`:

```sh
cloudflared tunnel route dns homelab weather.kajgm.com
dig @1.1.1.1 +short weather.kajgm.com
```

In `k8s/infra/cloudflared/manifests/config.yaml`, above the final `- service: http_status:404`:

```yaml
  - hostname: weather.kajgm.com
    service: http://weathertracker.weathertracker.svc.cluster.local:80
```

In the cloudflared NetworkPolicy egress (port is the pod's targetPort, not the Service port):

```yaml
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: weathertracker
      ports:
        - protocol: TCP
          port: 8080
```

```sh
kubectl kustomize k8s/infra/cloudflared/manifests | kubectl apply --dry-run=server -f -
```

## 5. Sync (workstation)

```sh
git add k8s/apps/weathertracker k8s/apps/kustomization.yaml k8s/infra/cloudflared
git commit -m "Add weathertracker app and tunnel route"
git push
argocd app sync homelab --core --kube-context argocd-core
argocd app sync weathertracker --core --kube-context argocd-core
argocd app sync cloudflared --core --kube-context argocd-core
```

Verify:

```sh
kubectl -n weathertracker get pods,svc
kubectl -n weathertracker exec deploy/weathertracker -- wget -qO- http://127.0.0.1:8080/healthz
curl -sI https://weather.kajgm.com | head -5     # from outside home: 302 to <team>.cloudflareaccess.com
curl -sI https://weather.kajgm.com | head -5     # from the Pi: 200
```

502 page = cloudflared can't reach the pod: `kubectl -n kube-system exec ds/cilium -- hubble observe -n weathertracker --verdict DROPPED`.

## 6. Raspberry Pi kiosk

The Pi only needs Chromium now; stop the old local container if present:

```sh
docker rm -f weathertracker 2>/dev/null || true
```

`startup.sh` defaults to `https://weather.kajgm.com/` (override with `WEATHERTRACKER_URL=...`).
Pull the repo on the Pi, then keep the existing autostart entry:

```sh
cd ~/weathertracker && git pull && chmod +x startup.sh && ./startup.sh
```

## Releasing an update

1. Merge to `main`, `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. In the homelab repo bump `newTag` in `k8s/apps/weathertracker/manifests/kustomization.yaml`, commit, push (auto-sync rolls it).
3. The kiosk picks up the new bundle on its next page load (`index.html` is served `no-cache`); reboot the Pi or restart `startup.sh` to force it.
