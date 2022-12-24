#!/bin/sh

if git rev-parse --quiet --verify $1 > /dev/null; then
    echo "::set-output name=can_create_pr::false"
else
    echo "::set-output name=can_create_pr::true"
fi