#!/bin/bash
if test -z "$*"; then
  sheep-help
else
  sheep-$*
fi
