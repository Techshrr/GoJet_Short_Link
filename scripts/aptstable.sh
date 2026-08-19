#!/usr/bin/env bash
set -euo pipefail

# GitHub-hosted Ubuntu runners can inherit the Azure Ubuntu mirror. That mirror
# has repeatedly stalled at very low transfer rates for this repository, so all
# CI jobs must normalize Ubuntu archive URLs before apt is allowed to run.
for source in /etc/apt/apt-mirrors.txt /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
  if [[ -f "$source" ]]; then
    sudo sed -i \
      -e 's#http://azure.archive.ubuntu.com/ubuntu#https://archive.ubuntu.com/ubuntu#g' \
      -e 's#https://azure.archive.ubuntu.com/ubuntu#https://archive.ubuntu.com/ubuntu#g' \
      -e 's#http://archive.ubuntu.com/ubuntu#https://archive.ubuntu.com/ubuntu#g' \
      -e 's#http://security.ubuntu.com/ubuntu#https://security.ubuntu.com/ubuntu#g' \
      "$source"
  fi
done

sudo tee /etc/apt/apt.conf.d/80gojetstable >/dev/null <<'EOF'
Acquire::Retries "5";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::ForceIPv4 "true";
APT::Get::Assume-Yes "true";
EOF

if grep -R -n -E '(^|[/:])azure\.archive\.ubuntu\.com/ubuntu' /etc/apt/apt-mirrors.txt /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null; then
  echo 'Azure Ubuntu archive URL is still present after normalization.' >&2
  exit 1
fi

sudo apt-get update -o Acquire::Retries=5
