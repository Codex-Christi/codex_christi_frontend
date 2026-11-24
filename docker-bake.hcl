# The same local image pair is built and loaded in a single BuildKit invocation.
# CI supplies the qualified immutable NODE_IMAGE, exact APP_REVISION, and
# capability/branch-gated cache flag. No environment files or app secrets.
variable "NODE_IMAGE" {
  default = null
}

variable "APP_REVISION" {
  default = null
}

variable "TRUSTED_BUILDKIT_CACHE" {
  type    = bool
  default = false
}

group "default" {
  targets = ["runtime", "datastore-check"]
}

target "_shared" {
  context    = "."
  dockerfile = "Dockerfile"
  platforms  = ["linux/amd64"]
  args = {
    NODE_IMAGE   = NODE_IMAGE
    APP_REVISION = APP_REVISION
  }
}

# Keep cache scopes distinct; exporting both targets to one scope would
# overwrite one graph. Export intermediate dependency layers (mode=max).
# Cache export is best-effort and time-bounded; images remain mandatory.
target "runtime" {
  inherits   = ["_shared"]
  target     = "runtime"
  tags       = ["codex-christi-next:${APP_REVISION}"]
  cache-from = TRUSTED_BUILDKIT_CACHE ? ["type=gha,version=2,scope=codex-christi-frontend-runtime-amd64-v1,timeout=60s"] : []
  cache-to   = TRUSTED_BUILDKIT_CACHE ? ["type=gha,version=2,scope=codex-christi-frontend-runtime-amd64-v1,mode=max,ignore-error=true,timeout=90s"] : []
}

target "datastore-check" {
  inherits   = ["_shared"]
  target     = "datastore-check"
  tags       = ["codex-christi-datastore-check:${APP_REVISION}"]
  cache-from = TRUSTED_BUILDKIT_CACHE ? ["type=gha,version=2,scope=codex-christi-frontend-checker-amd64-v1,timeout=60s"] : []
  cache-to   = TRUSTED_BUILDKIT_CACHE ? ["type=gha,version=2,scope=codex-christi-frontend-checker-amd64-v1,mode=max,ignore-error=true,timeout=90s"] : []
}
