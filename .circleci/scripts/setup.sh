#!/bin/bash

set -e

dir=$(dirname "$0")
while [[ "$1" ]]; do
   case "$1" in
      --hosts)
          "${dir}"/setup_hosts.sh
          ;;
      --db)
          "${dir}"/setup_db.sh
          ;;
      --aws)
        "${dir}"/setup_aws.sh
        ;;
    esac
    shift
done
