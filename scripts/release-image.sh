#!/usr/bin/env bash
#
# Build the SockBot Docker image, export it as a gzipped tarball, and attach it
# to the matching GitHub release. The NAS user downloads the tarball from the
# release page and imports it with `docker load`.
#
# Usage:
#   scripts/release-image.sh [version]
#
# Version defaults to the "version" field in package.json (e.g. 1.2.0). The
# matching release (tag v<version>) must already exist — create it first with
# `gh release create v<version> ...`.
#
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-$(node -p "require('./package.json').version")}"
TAG="v${VERSION}"
IMAGE="sockbot:${VERSION}"
TARBALL="sockbot-${VERSION}.tar.gz"

echo "Building ${IMAGE}..."
docker build -t "${IMAGE}" .

echo "Exporting ${IMAGE} -> ${TARBALL}..."
docker save "${IMAGE}" | gzip > "${TARBALL}"
echo "  tarball size: $(du -h "${TARBALL}" | cut -f1)"

echo "Uploading ${TARBALL} to release ${TAG}..."
gh release upload "${TAG}" "${TARBALL}" --clobber

echo "Cleaning up local tarball..."
rm -f "${TARBALL}"

echo "Done. ${TARBALL} is attached to release ${TAG}."
