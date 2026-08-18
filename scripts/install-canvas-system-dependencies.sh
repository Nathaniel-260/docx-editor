#!/usr/bin/env bash
set -euo pipefail

apt_timeout="${APT_COMMAND_TIMEOUT:-10m}"
apt_mirror_file="${APT_MIRROR_FILE:-/etc/apt/apt-mirrors.txt}"
export DEBIAN_FRONTEND="${DEBIAN_FRONTEND:-noninteractive}"

apt_opts=(
  -o Acquire::Retries=3
  -o Dpkg::Use-Pty=0
)

canvas_packages=(
  build-essential
  libcairo2-dev
  libpango1.0-dev
  libjpeg-dev
  libgif-dev
  librsvg2-dev
  libpixman-1-dev
)

if [ -n "${APT_ARCHIVE_CACHE_DIR:-}" ]; then
  mkdir -p "${APT_ARCHIVE_CACHE_DIR}"
  apt_opts+=(-o "Dir::Cache::Archives=${APT_ARCHIVE_CACHE_DIR}")
fi

run_apt() {
  local label="$1"
  shift

  echo "::group::${label}"
  echo "Running ${label} with ${apt_timeout} timeout"

  set +e
  timeout "${apt_timeout}" sudo apt-get "${apt_opts[@]}" "$@"
  local status=$?
  set -e

  echo "::endgroup::"

  if [ "${status}" -eq 0 ]; then
    return 0
  fi

  if [ "${status}" -eq 124 ]; then
    echo "::error::${label} timed out after ${apt_timeout}"
  else
    echo "::error::${label} failed with status ${status}"
  fi

  date -u '+utc=%Y-%m-%dT%H:%M:%SZ' || true
  ps -ef | grep -E '[a]pt|[d]pkg' || true
  if command -v fuser >/dev/null 2>&1; then
    sudo fuser -v /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/cache/apt/archives/lock || true
  fi
  df -h || true
  exit "${status}"
}

stabilize_github_apt_mirrors() {
  if [ "${GITHUB_ACTIONS:-}" != "true" ] || [ ! -f "${apt_mirror_file}" ]; then
    return 0
  fi
  if ! grep -qF 'azure.archive.ubuntu.com' "${apt_mirror_file}"; then
    return 0
  fi
  if ! grep -Eq 'https?://(archive|security)\.ubuntu\.com/ubuntu/' "${apt_mirror_file}"; then
    echo "::warning::Azure apt mirror is configured without an official Ubuntu fallback; leaving it unchanged."
    return 0
  fi

  local filtered_mirrors
  filtered_mirrors="$(mktemp)"
  awk '!/azure\.archive\.ubuntu\.com/' "${apt_mirror_file}" > "${filtered_mirrors}"
  sudo cp "${filtered_mirrors}" "${apt_mirror_file}"
  rm -f "${filtered_mirrors}"
  echo "::notice::Bypassing the unhealthy Azure apt mirror; using the configured official Ubuntu fallbacks."
}

missing_packages=()
for package in "${canvas_packages[@]}"; do
  if ! dpkg-query --show --showformat='${db:Status-Status}' "$package" 2>/dev/null | grep -qx installed; then
    missing_packages+=("$package")
  fi
done

if ((${#missing_packages[@]} == 0)); then
  echo "Canvas system dependencies are already installed."
  exit 0
fi

stabilize_github_apt_mirrors
run_apt "apt-get update" update
run_apt "apt-get install canvas system dependencies" install -y --no-install-recommends \
  "${missing_packages[@]}"
